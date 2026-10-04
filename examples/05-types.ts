/**
 * How JavaScript values map to DBus types and back, how a variant's type is inferred, and how to choose it explicitly.
 *
 * An echo service with one method per signature returns its argument unchanged; the client sends values and prints
 * what comes back. Both run in this process.
 *
 * Run: node examples/05-types.ts   (in this repository: npm run example -- examples/05-types.ts)
 */
import {DBus, DBusSignedValue, DBusUInt32, LocalInterface, LocalObject, LocalService, type MethodCallContext} from 'dbus-sdk'

const SIGNATURES: string[] = ['y', 'b', 'n', 'q', 'i', 'u', 'x', 't', 'd', 's', 'o', 'g', 'as', 'ay', '(si)', 'a{si}', 'a{is}', 'a(ss)', 'a{sv}', 'v']

// --- Echo service: Echo_<n> takes and returns one value of SIGNATURES[n]
const echo: LocalInterface = new LocalInterface('org.example.Echo1')
SIGNATURES.forEach((signature: string, index: number): void => {
    echo.defineMethod({
        name: `Echo_${index}`,
        inputArgs: [{type: signature}],
        outputArgs: [{type: signature}],
        method: (value: unknown): unknown => value
    })
})
// Types(a{sv}) answers with the type each variant arrived with, read from the call's message decoded with types kept
echo.defineMethod({
    name: 'Types',
    inputArgs: [{type: 'a{sv}'}],
    outputArgs: [{type: 'a{ss}'}],
    withContext: true,
    method: (_values: unknown, context: MethodCallContext): Record<string, string> => {
        const [received] = context.message.getBody({types: 'variants'})
        return Object.fromEntries(Object.entries(received as Record<string, DBusSignedValue>).map(([key, value]): [string, string] => [key, value.signature]))
    }
})
const object: LocalObject = new LocalObject('/org/example/Echo')
object.addInterface(echo)
const service: LocalService = new LocalService('org.example.Echo')
service.addObject(object)
await service.run()

const bus: DBus = await DBus.connect()

/**
 * Sends a value with the given signature and returns what comes back.
 */
async function roundTrip(signature: string, value: unknown): Promise<unknown> {
    const [result] = await bus.invoke({
        service: 'org.example.Echo',
        objectPath: '/org/example/Echo',
        interface: 'org.example.Echo1',
        method: `Echo_${SIGNATURES.indexOf(signature)}`,
        signature: signature,
        args: [value]
    })
    return result
}

const show = (label: string, value: unknown): void => console.log(label.padEnd(40), value)

// --- Basic types
show('y (byte) 255', await roundTrip('y', 255))
show('b (boolean) true', await roundTrip('b', true))
show('n, q, i, u: number', [await roundTrip('n', -1), await roundTrip('q', 1), await roundTrip('i', -2), await roundTrip('u', 2)])
show('x, t (64-bit): bigint', [await roundTrip('x', -(2n ** 62n)), await roundTrip('t', 2n ** 63n)])
show('x also takes a number or decimal string', [await roundTrip('x', 42), await roundTrip('x', '9007199254740993')])
show('d (double)', await roundTrip('d', 0.1))
show('s, o, g: string', [await roundTrip('s', 'text'), await roundTrip('o', '/org/example'), await roundTrip('g', 'a{sv}')])

// --- Containers
show('as (array)', await roundTrip('as', ['a', 'b']))
show('ay (bytes): Buffer', await roundTrip('ay', Buffer.from('hi')))
show('(si) (struct): array of fields', await roundTrip('(si)', ['answer', 42]))
show('a{si} (dictionary): object', await roundTrip('a{si}', {one: 1, two: 2}))
// Dictionaries decode to objects, so their keys become property names (strings)
show('a{is} from [key, value] pairs', await roundTrip('a{is}', [[1, 'one'], [2, 'two']]))
show('a(ss) (array of structs)', await roundTrip('a(ss)', [['k', 'v'], ['k2', 'v2']]))

// --- Variants. A plain value given for 'v' gets its type inferred:
//     string → s, boolean → b, integer → i (x beyond INT32), other number → d, bigint → x, Buffer → ay,
//     array → a + the items' type (a struct if they differ), other object → a{sv}
// DBusSignedValue.inferSignature tells which signature a value is sent with.
const inferred = (value: unknown): string => DBusSignedValue.inferSignature(value)
show('inferred: "x", 7, 2 ** 40, 0.5', [inferred('x'), inferred(7), inferred(2 ** 40), inferred(0.5)])
show('inferred: [1, 2], [1, "a"], {a: 1}, [{a: 1}]', [inferred([1, 2]), inferred([1, 'a']), inferred({a: 1}), inferred([{a: 1}])])
show('a{sv} from a plain object', await roundTrip('a{sv}', {name: 'disk', size: 2 ** 40, ratio: 0.5, tags: ['a', 'b']}))

// For another type than the inferred one, wrap the value in a DBusSignedValue or a type class
// (DBusByte, DBusUInt32, DBusInt64, DBusObjectPath, ... one per DBus type)
show('inferred: DBusSignedValue("u", 7)', inferred(new DBusSignedValue('u', 7)))
show('inferred: new DBusUInt32(7)', inferred(new DBusUInt32(7)))
show('a{sv} with typed values', await roundTrip('a{sv}', {count: new DBusSignedValue('u', 7), path: new DBusSignedValue('o', '/a')}))

// --- Through a proxy, arguments take the signature from introspection: plain values are enough
const proxy = await bus.getInterface('org.example.Echo', '/org/example/Echo', 'org.example.Echo1')
show('proxy, a{si} as a plain object', await proxy.method[`Echo_${SIGNATURES.indexOf('a{si}')}`]({one: 1}))

// --- Receiving with types kept: decode {types: 'variants'} gives each variant's content as a type class instance,
//     with .signature and .value; {types: 'all'} does so for every value
const [typed] = await bus.invoke({
    service: 'org.example.Echo', objectPath: '/org/example/Echo', interface: 'org.example.Echo1',
    method: `Echo_${SIGNATURES.indexOf('a{sv}')}`, signature: 'a{sv}', args: [{mtu: new DBusUInt32(1500), dns: new DBusSignedValue('au', [])}],
    decode: {types: 'variants'}
})
show('types variants: mtu, dns', [`${typed.mtu.constructor.name} ${typed.mtu.signature} ${typed.mtu.value}`, `${typed.dns.signature} ${JSON.stringify(typed.dns.value)}`])
// Received plain values keep their types too when the object holding them is sent again, even after a change in
// place; a copy made by spreading infers them again
const types = async (value: unknown): Promise<unknown> => (await bus.invoke({service: 'org.example.Echo', objectPath: '/org/example/Echo', interface: 'org.example.Echo1', method: 'Types', signature: 'a{sv}', args: [value]}))[0]
const [plain] = await bus.invoke({service: 'org.example.Echo', objectPath: '/org/example/Echo', interface: 'org.example.Echo1', method: `Echo_${SIGNATURES.indexOf('a{sv}')}`, signature: 'a{sv}', args: [{mtu: new DBusUInt32(1500), dns: new DBusSignedValue('au', [])}]})
plain.mtu = 9000
show('sent back after a change in place', await types(plain))
show('sent back as a spread copy', await types({...plain}))
show('types variants, sent back as a copy', await types({...typed}))

// --- Values that do not fit their type are rejected before anything is sent
for (const [signature, value] of [['y', 256], ['u', -1], ['b', 'false'], ['o', 'no/slash']] as [string, unknown][]) {
    try {
        await roundTrip(signature, value)
    } catch (error) {
        show(`${signature} ${JSON.stringify(value)}`, `${(error as Error).name}: ${(error as Error).message}`)
    }
}

await bus.disconnect()
await service.stop()
