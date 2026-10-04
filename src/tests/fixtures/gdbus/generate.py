#!/usr/bin/env python3
"""
Generates wire-matrix.json: DBus wire-format reference vectors produced by GLib's GDBus,
an implementation independent of this library.

Every case lists the body signature, its arguments, the body bytes in both byte orders, and the
GVariant text form used to drive `gdbus call` in the integration tests.
Arguments are stored in a tagged JSON form that the tests turn into library inputs and expected
decoded values (see src/tests/helpers/TaggedValue.ts):

    {"$bigint": "123"}                       x / t
    {"$double": "NaN" | "Infinity" | "-Infinity" | "-0"}
    {"$bytes": "hex"}                        ay
    {"$dict": [[key, value], ...]}           a{..}
    {"$struct": [field, ...]}                (..)
    {"$variant": {"signature": s, "value": v}}   v with an explicit inner type
    {"$infer": {"signature": s, "value": v}}     v given as a plain value; s is the type the library infers

Requires PyGObject (python3 -c "import gi"). Run from the repository root:

    python3 src/tests/fixtures/gdbus/generate.py
"""
import json
import math
import os

import gi

gi.require_version('Gio', '2.0')
from gi.repository import Gio, GLib  # noqa: E402

OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wire-matrix.json')

BASIC_VALUES = {
    'y': [0, 1, 127, 255],
    'b': [True, False],
    'n': [-32768, -1, 0, 32767],
    'q': [0, 1, 65535],
    'i': [-2147483648, -1, 0, 2147483647],
    'u': [0, 1, 4294967295],
    'x': [-(2 ** 63), -1, 0, 2 ** 63 - 1],
    't': [0, 1, 2 ** 64 - 1],
    'd': [0.0, -0.0, 1.5, -2.25e-300, 1.7976931348623157e308, float('nan'), float('inf'), float('-inf')],
    'h': [0, 3],
    's': ['', 'a', 'hello world', '中文 ✓ 😀', 'x' * 300],
    'o': ['/', '/a', '/org/example/Object_1'],
    'g': ['', 's', 'a{sv}', '(ia{s(xv)})'],
}

# Two distinct, "ordinary" values per type for use inside containers (no NaN or -0, which cannot be dict keys)
SAMPLE = {
    'y': (1, 255), 'b': (True, False), 'n': (-2, 300), 'q': (3, 65535), 'i': (-4, 70000), 'u': (5, 4294967295),
    'x': (-6, 2 ** 40), 't': (7, 2 ** 64 - 1), 'd': (1.5, -0.25), 'h': (0, 2), 's': ('a', 'bc'),
    'o': ('/a', '/b/c'), 'g': ('s', 'a{sv}'),
}

BASIC_TYPES = list(BASIC_VALUES.keys())

# Leading arguments that make the next value start at offset 1..7 (before its own alignment padding)
OFFSET_PREFIXES = [
    ('y', [9]),
    ('n', [-9]),
    ('ny', [-9, 9]),
    ('u', [9]),
    ('uy', [9, 9]),
    ('un', [9, -9]),
    ('uny', [9, -9, 9]),
]


# --- signature parsing -------------------------------------------------------------------------

def split_signature(signature):
    """Splits a signature into its top-level complete types."""
    types, index = [], 0
    while index < len(signature):
        end = complete_type_end(signature, index)
        types.append(signature[index:end])
        index = end
    return types


def complete_type_end(signature, index):
    c = signature[index]
    if c == 'a':
        return complete_type_end(signature, index + 1)
    if c in '({':
        closing = ')' if c == '(' else '}'
        index += 1
        while signature[index] != closing:
            index = complete_type_end(signature, index)
        return index + 1
    return index + 1


# --- conversion to GLib values and tagged JSON ---------------------------------------------------

def to_glib(signature, value):
    """Converts a generator value into what GLib.Variant accepts for the signature."""
    c = signature[0]
    if c == 'v':
        inner_signature, inner_value = value
        return GLib.Variant(inner_signature, to_glib(inner_signature, inner_value))
    if c == 'a' and signature[1] == '{':
        key_type, value_type = split_signature(signature[2:-1])
        return {to_glib(key_type, k): to_glib(value_type, v) for k, v in value}
    if c == 'a' and signature[1] == 'y':
        return bytes(value)
    if c == 'a':
        return [to_glib(signature[1:], item) for item in value]
    if c == '(':
        return tuple(to_glib(t, v) for t, v in zip(split_signature(signature[1:-1]), value))
    return value


def to_tagged(signature, value, infer=False):
    c = signature[0]
    if c == 'v':
        inner_signature, inner_value = value
        return {'$infer' if infer else '$variant': {'signature': inner_signature, 'value': to_tagged(inner_signature, inner_value)}}
    if c in 'xt':
        return {'$bigint': str(value)}
    if c == 'd':
        if math.isnan(value):
            return {'$double': 'NaN'}
        if math.isinf(value):
            return {'$double': 'Infinity' if value > 0 else '-Infinity'}
        if value == 0 and math.copysign(1, value) < 0:
            return {'$double': '-0'}
        return value
    if c == 'a' and signature[1] == '{':
        key_type, value_type = split_signature(signature[2:-1])
        return {'$dict': [[to_tagged(key_type, k), to_tagged(value_type, v, infer)] for k, v in value]}
    if c == 'a' and signature[1] == 'y':
        return {'$bytes': bytes(value).hex()}
    if c == 'a':
        return [to_tagged(signature[1:], item, infer) for item in value]
    if c == '(':
        return {'$struct': [to_tagged(t, v, infer) for t, v in zip(split_signature(signature[1:-1]), value)]}
    return value


def body_bytes(signature, args, byte_order):
    message = Gio.DBusMessage.new_signal('/t', 'a.B', 'C')
    message.set_serial(1)
    message.set_byte_order(byte_order)
    types = split_signature(signature)
    message.set_body(GLib.Variant('(' + signature + ')', tuple(to_glib(t, a) for t, a in zip(types, args))))
    blob = bytes(message.to_blob(Gio.DBusCapabilityFlags.NONE))
    body_length = int.from_bytes(blob[4:8], 'little' if blob[0] == ord('l') else 'big')
    return blob[len(blob) - body_length:] if body_length else b''


def gvariant_text(signature, value):
    return GLib.Variant(signature, to_glib(signature, value)).print_(True)


# --- case generation ---------------------------------------------------------------------------

cases = []
seen_ids = set()


def add(category, signature, args, infer=False, label=None):
    types = split_signature(signature)
    assert len(types) == len(args), (signature, args)
    case_id = f'{category}: {signature}' + (f' [{label}]' if label else '')
    suffix = 2
    unique_id = case_id
    while unique_id in seen_ids:
        unique_id = f'{case_id} #{suffix}'
        suffix += 1
    seen_ids.add(unique_id)
    cases.append({
        'id': unique_id,
        'category': category,
        'signature': signature,
        'args': [to_tagged(t, a, infer) for t, a in zip(types, args)],
        'le': body_bytes(signature, args, Gio.DBusMessageByteOrder.LITTLE_ENDIAN).hex(),
        'be': body_bytes(signature, args, Gio.DBusMessageByteOrder.BIG_ENDIAN).hex(),
        'texts': [gvariant_text(t, a) for t, a in zip(types, args)],
        'replyText': GLib.Variant('(' + signature + ')', tuple(to_glib(t, a) for t, a in zip(types, args))).print_(True),
    })


# Basic types with boundary values
for t, values in BASIC_VALUES.items():
    for value in values:
        add('basic', t, [value], label=gvariant_text(t, value)[:40])

for t in BASIC_TYPES:
    a, b = SAMPLE[t]
    # Arrays
    add('array', 'a' + t, [[]], label='empty')
    add('array', 'a' + t, [[a]])
    add('array', 'a' + t, [[a, b]])
    add('array', 'aa' + t, [[[a], [], [b, a]]])
    # Dictionaries with T as key and as value
    add('dict', 'a{' + t + 's}', [[(a, 'first'), (b, 'second')]])
    add('dict', 'a{s' + t + '}', [[('first', a), ('second', b)]])
    add('dict', 'a{s' + t + '}', [[]], label='empty')
    # Structs placing T after, before and between bytes
    add('struct', '(y' + t + ')', [(1, a)])
    add('struct', '(' + t + 'y)', [(a, 1)])
    add('struct', '(y' + t + 'y)', [(1, b, 2)])
    add('struct', 'a(y' + t + ')', [[(1, a), (2, b)]])
    # Variant holding T
    add('variant', 'v', [(t, a)], label=t)
    add('variant', 'av', [[(t, a), (t, b)]], label=t)
    # Alignment: the same forms starting at every offset 1..7 modulo 8
    for prefix, prefix_value in OFFSET_PREFIXES:
        add('offset', prefix + t, [*prefix_value, a])
        add('offset', prefix + 'a' + t, [*prefix_value, [a, b]])
        add('offset', prefix + 'a' + t, [*prefix_value, []], label='empty')
        add('offset', prefix + 'a{s' + t + '}', [*prefix_value, [('k', a)]])
        add('offset', prefix + '(y' + t + ')', [*prefix_value, (1, a)])
        add('offset', prefix + 'v', [*prefix_value, (t, a)], label=t)

# Nested containers
add('nested', 'a{sv}', [[('s', ('s', 'x')), ('i', ('i', 1)), ('d', ('d', 1.5)), ('x', ('x', 2 ** 40)), ('ay', ('ay', [1, 2])),
                         ('as', ('as', ['a', 'b'])), ('dict', ('a{sv}', [('k', ('u', 1))])), ('struct', ('(is)', (1, 'a')))]])
add('nested', 'a{sa{sv}}', [[('outer', [('inner', ('t', 5))]), ('empty', [])]])
add('nested', 'aa{sv}', [[[('a', ('i', 1))], [('b', ('s', 'x'))]]])
add('nested', 'a(sa{sv})', [[('a', [('k', ('b', True))]), ('b', [])]])
add('nested', '(a{sv}(ii)as)', [([('k', ('d', 2.5))], (1, 2), ['x', 'y'])])
add('nested', 'a{s(ii)}', [[('k', (1, 2)), ('m', (3, 4))]])
add('nested', 'a{sas}', [[('k', ['a', 'b']), ('m', [])]])
add('nested', 'a{s(xa{sv})}', [[('k', (7, [('v', ('ax', [1, 2]))]))]])
add('nested', 'a{oa{sa{sv}}}', [[('/org/a', [('org.example.I', [('P', ('u', 1))])])]])
add('nested', 'aay', [[[1, 2], [], [3]]])
add('nested', 'a(yx)', [[(1, 2), (3, 4)]])
add('nested', 'a(xy)', [[(1, 2), (3, 4)]])
add('nested', 'a(ax)', [[([1], ), ([], ), ([2, 3], )]])
add('nested', 'aaax', [[[[1]], [], [[2], []]]])
add('nested', '((((i))))', [((((1,),),),)])
add('nested', '(i(sx))', [(1, ('a', 2))])
add('nested', 'v', [('v', ('s', 'variant in variant'))], label='v of v')
add('nested', 'v', [('a{sv}', [('k', ('x', 3))])], label='a{sv}')
add('nested', 'v', [('(xs)', (1, 'a'))], label='(xs)')
add('nested', 'v', [('ax', [1, 2])], label='ax')
add('nested', 'v', [('aay', [[1], [2]])], label='aay')
nested_array, nested_struct = 1, 1
for _ in range(32):
    nested_array, nested_struct = [nested_array], (nested_struct,)
add('nested', 'a' * 32 + 'i', [nested_array], label='32 nested arrays')
add('nested', '(' * 32 + 'i' + ')' * 32, [nested_struct], label='32 nested structs')
add('nested', 'ay', [list(range(256)) * 4], label='1 KiB')
add('nested', 'as', [[f'item-{i}' for i in range(100)]], label='100 strings')
add('nested', 'sa{sv}as', ['org.example.I', [('P', ('s', 'v'))], ['Q']], label='PropertiesChanged')
add('nested', 'oa{sa{sv}}', ['/org/a', [('org.example.I', [('P', ('i', 1))])]], label='InterfacesAdded')

# Variants given as plain values: the library infers the inner type
add('infer', 'v', [('s', 'text')], infer=True, label='string')
add('infer', 'v', [('i', 42)], infer=True, label='integer')
add('infer', 'v', [('d', 1.5)], infer=True, label='float')
add('infer', 'v', [('b', True)], infer=True, label='boolean')
add('infer', 'v', [('x', 2 ** 40)], infer=True, label='bigint')
add('infer', 'v', [('ay', [1, 2])], infer=True, label='Buffer')
add('infer', 'v', [('as', ['a', 'b'])], infer=True, label='string array')
add('infer', 'v', [('ai', [1, 2])], infer=True, label='number array')
add('infer', 'v', [('a{sv}', [('k', ('s', 'v'))])], infer=True, label='object')
add('infer', 'v', [('a{sv}', [])], infer=True, label='empty object')
add('infer', 'v', [('(is)', (1, 'a'))], infer=True, label='mixed array')
add('infer', 'a{sv}', [[('a', ('i', 1)), ('b', ('s', 'x')), ('c', ('b', False)), ('d', ('a{sv}', [('e', ('d', 0.5))]))]], infer=True, label='object')

# Methods used by the echo services in the integration tests, one per distinct signature
signatures = sorted({case['signature'] for case in cases})
echo_methods = {signature: f'Echo{index}' for index, signature in enumerate(signatures)}

with open(OUTPUT, 'w', encoding='utf-8') as output:
    json.dump({
        'generator': f'GLib {GLib.MAJOR_VERSION}.{GLib.MINOR_VERSION}.{GLib.MICRO_VERSION} GDBus',
        'echoMethods': echo_methods,
        'cases': cases,
    }, output, ensure_ascii=False, indent=1)
    output.write('\n')

print(f'{len(cases)} cases, {len(signatures)} signatures -> {os.path.relpath(OUTPUT)}')
