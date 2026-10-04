import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBusBufferEncoder} from '../../lib/DBusBufferEncoder'
import {DBusBufferDecoder} from '../../lib/DBusBufferDecoder'
import {DBusMessageEndianness} from '../../lib/enums/DBusMessageEndianness'
import {Signature} from '../../lib/Signature'
import {knownBug} from '../helpers/KnownBug'
import {hex} from '../helpers/Hex'

/**
 * Wraps a value `depth` times.
 */
function nest(depth: number, value: any, wrap: (inner: any) => any): any {
    for (let i: number = 0; i < depth; i++) value = wrap(value)
    return value
}

interface InvalidEncoding {
    signature: string
    value: any
    label: string
    bug?: string
}

const SILENT_BYTE_TRUNCATION: string = 'BYTE values are masked to 8 bits instead of rejected'
const NON_INTEGER_ACCEPTED: string = 'non-integer numbers are truncated instead of rejected'
const LENIENT_BOOLEAN: string = 'any truthy or falsy value is accepted as BOOLEAN'
const NAN_ACCEPTED: string = 'non-numeric values are written as NaN instead of rejected'
const NUL_IN_STRING: string = 'strings containing NUL are written although the specification forbids them'
const SIGNATURE_NOT_VALIDATED: string = 'SIGNATURE values are written without validating their content'
const NESTING_NOT_LIMITED: string = 'signatures nesting deeper than the specification allows (32 arrays, 32 structs) are accepted'

/**
 * Values the encoder must refuse instead of producing a corrupt or silently altered message.
 * A message that violates the specification makes dbus-daemon drop the connection.
 */
const INVALID_ENCODINGS: InvalidEncoding[] = [
    {signature: 'y', value: 256, label: 'byte above 255', bug: SILENT_BYTE_TRUNCATION},
    {signature: 'y', value: -1, label: 'negative byte', bug: SILENT_BYTE_TRUNCATION},
    {signature: 'y', value: 1.5, label: 'non-integer byte', bug: SILENT_BYTE_TRUNCATION},
    {signature: 'n', value: 32768, label: 'int16 above range'},
    {signature: 'n', value: -32769, label: 'int16 below range'},
    {signature: 'q', value: -1, label: 'negative uint16'},
    {signature: 'q', value: 65536, label: 'uint16 above range'},
    {signature: 'i', value: 2 ** 31, label: 'int32 above range'},
    {signature: 'i', value: -(2 ** 31) - 1, label: 'int32 below range'},
    {signature: 'i', value: 1.5, label: 'non-integer int32', bug: NON_INTEGER_ACCEPTED},
    {signature: 'u', value: -1, label: 'negative uint32'},
    {signature: 'u', value: 2 ** 32, label: 'uint32 above range'},
    {signature: 'u', value: 1.5, label: 'non-integer uint32', bug: NON_INTEGER_ACCEPTED},
    {signature: 'h', value: -1, label: 'negative unix fd index'},
    {signature: 'x', value: 2n ** 63n, label: 'int64 above range'},
    {signature: 'x', value: -(2n ** 63n) - 1n, label: 'int64 below range'},
    {signature: 'x', value: 1.5, label: 'non-integer int64'},
    {signature: 't', value: -1n, label: 'negative uint64'},
    {signature: 't', value: 2n ** 64n, label: 'uint64 above range'},
    {signature: 'd', value: 'abc', label: 'non-numeric double', bug: NAN_ACCEPTED},
    {signature: 'b', value: 'yes', label: 'string as boolean', bug: LENIENT_BOOLEAN},
    {signature: 'b', value: 'false', label: 'the string "false" as boolean', bug: LENIENT_BOOLEAN},
    {signature: 'b', value: 2, label: '2 as boolean', bug: LENIENT_BOOLEAN},
    {signature: 'b', value: null, label: 'null as boolean', bug: LENIENT_BOOLEAN},
    {signature: 's', value: 'a\u0000b', label: 'string containing NUL', bug: NUL_IN_STRING},
    {signature: 's', value: 5, label: 'number as string'},
    {signature: 'o', value: 'relative/path', label: 'relative object path'},
    {signature: 'o', value: '/a//b', label: 'object path with empty element'},
    {signature: 'o', value: '/a-b', label: 'object path with invalid character'},
    {signature: 'g', value: 'z', label: 'signature with unknown type code', bug: SIGNATURE_NOT_VALIDATED},
    {signature: 'g', value: '(i', label: 'unbalanced signature', bug: SIGNATURE_NOT_VALIDATED},
    {signature: 'g', value: 'y'.repeat(256), label: 'signature longer than 255 bytes'},
    {signature: 'v', value: undefined, label: 'undefined as variant'},
    {signature: 'ai', value: 'not an array', label: 'string as array'},
    {signature: '(ii)', value: [1], label: 'struct with too few fields'},
    {signature: '(ii)', value: [1, 2, 3], label: 'struct with too many fields'},
    // Values have the right shape, so exceeding the nesting limit is the only reason to refuse them
    {signature: 'a'.repeat(33) + 'i', value: nest(33, 1, (inner: any): any[] => [inner]), label: '33 nested arrays', bug: NESTING_NOT_LIMITED},
    {signature: '('.repeat(33) + 'i' + ')'.repeat(33), value: nest(33, 1, (inner: any): any[] => [inner]), label: '33 nested structs', bug: NESTING_NOT_LIMITED}
]

const INVALID_SIGNATURES: [string, string][] = [
    ['z', 'unknown type code'],
    ['(i', 'unclosed struct'],
    ['i)', 'unopened struct'],
    ['()', 'empty struct'],
    ['a', 'array without element type'],
    ['{ss}', 'dict entry outside an array'],
    ['a{s}', 'dict entry with one type'],
    ['a{sss}', 'dict entry with three types'],
    ['a{vs}', 'dict entry with a variant key'],
    ['a{(i)s}', 'dict entry with a struct key'],
    ['a{ais}', 'dict entry with an array key']
]

interface MalformedInput {
    signature: string
    wire: Buffer
    label: string
    /**
     * Required message of the error, when the input is also malformed in a less specific way that would be
     * rejected anyway (the 64 MiB array cannot be provided in full, so its length also exceeds the data).
     */
    reason?: RegExp
    bug?: string
}

/**
 * Malformed wire data the decoder must reject rather than misread.
 */
const MALFORMED_INPUTS: MalformedInput[] = [
    {signature: 'ai', wire: hex('08000000 01000000'), label: 'array length beyond the end of the data'},
    {signature: 'ay', wire: hex('01000004 00'), label: 'array longer than the 64 MiB maximum', reason: /64 MiB|maximum|67108864/, bug: 'array lengths are not checked against the 64 MiB maximum'},
    {signature: 's', wire: hex('02000000 ff fe 00'), label: 'string that is not valid UTF-8', bug: 'invalid UTF-8 is replaced with U+FFFD instead of rejected'},
    {signature: 's', wire: hex('03000000 61 00 62 00'), label: 'string containing NUL', bug: 'strings containing NUL are accepted'},
    {signature: 'o', wire: hex('01000000 61 00'), label: 'invalid object path', bug: 'OBJECT_PATH values are not validated when decoding'},
    {signature: 'g', wire: hex('01 7a 00'), label: 'invalid signature value', bug: 'SIGNATURE values are not validated when decoding'},
    {signature: 'v', wire: hex('01 7a 00'), label: 'variant with unknown type code'},
    {signature: 'v', wire: hex('02 6969 00 01000000 01000000'), label: 'variant signature with two types'},
    {signature: 'b', wire: hex('02000000'), label: 'boolean other than 0 or 1'},
    {signature: 'yu', wire: hex('01 ff0000 01000000'), label: 'non-zero alignment padding', bug: 'non-zero alignment padding is accepted'},
    {signature: 's', wire: hex('02000000 6162'), label: 'string without NUL terminator'},
    {signature: 'u', wire: hex('0100'), label: 'truncated integer'}
]

describe('invalid input', (): void => {

    describe('encoder rejects values it cannot represent', (): void => {
        for (const invalid of INVALID_ENCODINGS) {
            it(`${invalid.signature}: ${invalid.label}`, invalid.bug ? knownBug(invalid.bug) : {}, (): void => {
                assert.throws((): Buffer => new DBusBufferEncoder().encode(invalid.signature, invalid.value))
            })
        }
    })

    describe('signature parser rejects invalid signatures', (): void => {
        for (const [signature, label] of INVALID_SIGNATURES) {
            const bug: string | undefined = ['i)', '()', '{ss}', 'a{s}', 'a{sss}', 'a{vs}', 'a{(i)s}', 'a{ais}'].includes(signature) ? 'the signature parser does not enforce the structural rules for structs and dict entries' : undefined
            it(`'${signature}': ${label}`, bug ? knownBug(bug) : {}, (): void => {
                assert.throws((): any => Signature.parseSignature(signature))
            })
        }
    })

    describe('decoder rejects malformed data', (): void => {
        for (const malformed of MALFORMED_INPUTS) {
            it(`${malformed.signature}: ${malformed.label}`, malformed.bug ? knownBug(malformed.bug) : {}, (): void => {
                assert.throws((): any[] => new DBusBufferDecoder(DBusMessageEndianness.LE, malformed.wire).decode(malformed.signature), malformed.reason || Error)
            })
        }
    })

    describe('accepted boolean forms', (): void => {
        for (const [value, expected] of [[true, '01000000'], [false, '00000000'], [1, '01000000'], [0, '00000000']] as [any, string][]) {
            it(`encodes ${JSON.stringify(value)}`, (): void => {
                assert.equal(new DBusBufferEncoder().encode('b', value).toString('hex'), expected)
            })
        }
    })
})
