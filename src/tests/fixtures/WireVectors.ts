import {hex} from '../helpers/Hex'
import {DBusSignedValue} from '../../lib/DBusSignedValue'
import {DBusUint32} from '../../lib/datatypes/DBusUint32'

export interface WireVector {
    signature: string
    /**
     * Top-level arguments, one per complete type in the signature.
     */
    args: any[]
    /**
     * Expected little-endian wire bytes when encoded starting at offset 0, per the DBus specification.
     */
    wire: Buffer
    /**
     * Values expected from decoding `wire`, when they differ from `args` (e.g. byte arrays decode to Buffer).
     */
    decoded?: any[]
    /**
     * Set when encoding is known to be wrong; describes the defect.
     */
    encodeBug?: string
    /**
     * Set when decoding the spec bytes is known to be wrong; describes the defect.
     */
    decodeBug?: string
}

const ARRAY_PADDING_BUG: string = 'array content of 8-byte aligned element types is not padded to 8 after the length field'
const NESTED_ALIGNMENT_BUG: string = 'array content is aligned relative to the array start instead of the message start'
const VARIANT_ARGUMENT_BUG: string = 'a DBusSignedValue passed for a top-level variant in a multi-argument signature is written without the variant signature'

/**
 * Wire-format vectors derived from the DBus specification (alignment, padding, length fields),
 * cross-checked against libdbus output where possible (see LibdbusMessages).
 */
export const WireVectors: WireVector[] = [
    // Basic types
    {signature: 'y', args: [0x12], wire: hex('12')},
    {signature: 'b', args: [true], wire: hex('01000000')},
    {signature: 'b', args: [false], wire: hex('00000000')},
    {signature: 'n', args: [-2], wire: hex('feff')},
    {signature: 'q', args: [0x1234], wire: hex('3412')},
    {signature: 'i', args: [-1], wire: hex('ffffffff')},
    {signature: 'u', args: [1], wire: hex('01000000')},
    {signature: 'x', args: [-1n], wire: hex('ffffffffffffffff')},
    {signature: 't', args: [2n ** 64n - 1n], wire: hex('ffffffffffffffff')},
    {signature: 'd', args: [1], wire: hex('000000000000f03f')},
    {signature: 'h', args: [3], wire: hex('03000000')},
    {signature: 's', args: ['ab'], wire: hex('02000000 616200')},
    {signature: 's', args: [''], wire: hex('00000000 00')},
    {signature: 's', args: ['中'], wire: hex('03000000 e4b8ad 00')},
    {signature: 'o', args: ['/a'], wire: hex('02000000 2f6100')},
    {signature: 'o', args: ['/'], wire: hex('01000000 2f00')},
    {signature: 'g', args: ['a{sv}'], wire: hex('05 617b73767d 00')},

    // Alignment between consecutive top-level values
    {signature: 'yu', args: [1, 2], wire: hex('01 000000 02000000')},
    {signature: 'yx', args: [1, 2n], wire: hex('01 00000000000000 0200000000000000')},
    {signature: 'ys', args: [1, 'a'], wire: hex('01 000000 01000000 6100')},
    {signature: '(yx)', args: [[1, 2n]], wire: hex('01 00000000000000 0200000000000000')},

    // Arrays
    {signature: 'ay', args: [Buffer.from([1, 2, 3])], wire: hex('03000000 010203')},
    {signature: 'ay', args: [[1, 2, 3]], wire: hex('03000000 010203'), decoded: [Buffer.from([1, 2, 3])]},
    {signature: 'ai', args: [[1, 2]], wire: hex('08000000 01000000 02000000')},
    {signature: 'as', args: [['a', 'bc']], wire: hex('0f000000 01000000 6100 0000 02000000 626300')},
    {signature: 'ax', args: [[1n]], wire: hex('08000000 00000000 0100000000000000'), encodeBug: ARRAY_PADDING_BUG, decodeBug: ARRAY_PADDING_BUG},
    {signature: 'ad', args: [[1]], wire: hex('08000000 00000000 000000000000f03f'), encodeBug: ARRAY_PADDING_BUG, decodeBug: ARRAY_PADDING_BUG},
    {signature: 'ax', args: [[]], wire: hex('00000000 00000000'), encodeBug: ARRAY_PADDING_BUG},
    {signature: 'a(ii)', args: [[[1, 2]]], wire: hex('08000000 00000000 01000000 02000000')},
    {signature: 'aax', args: [[[1n]]], wire: hex('0c000000 08000000 0100000000000000')},
    {signature: 'yaax', args: [1, [[1n]]], wire: hex('01000000 10000000 08000000 00000000 0100000000000000'), encodeBug: NESTED_ALIGNMENT_BUG, decodeBug: NESTED_ALIGNMENT_BUG},

    // Dictionaries
    {signature: 'a{sv}', args: [{a: 1}], wire: hex('10000000 00000000 01000000 6100 016900 000000 01000000')},
    {signature: 'a{sx}', args: [{a: 1n}], wire: hex('10000000 00000000 01000000 6100 0000 0100000000000000')},
    {signature: 'a{sv}', args: [{}], wire: hex('00000000 00000000')},

    // Variants
    {signature: 'v', args: ['hi'], wire: hex('01 7300 00 02000000 686900')},
    {signature: 'v', args: [1], wire: hex('01 6900 00 01000000')},
    {signature: 'v', args: [true], wire: hex('01 6200 00 01000000')},
    {signature: 'v', args: [1.5], wire: hex('01 6400 0000000000 000000000000f83f')},
    {signature: 'v', args: [new DBusSignedValue('u', 7)], wire: hex('01 7500 00 07000000'), decoded: [7]},
    {signature: '(yv)', args: [[1, 1n]], wire: hex('01 017800 00000000 0100000000000000')},
    {signature: 'av', args: [[1n]], wire: hex('0c000000 017800 00 0100000000000000'), encodeBug: NESTED_ALIGNMENT_BUG, decodeBug: NESTED_ALIGNMENT_BUG},
    {signature: 'sv', args: ['a', new DBusSignedValue('u', 7)], wire: hex('01000000 6100 017500 000000 07000000'), decoded: ['a', 7], encodeBug: VARIANT_ARGUMENT_BUG},
    {signature: 'sv', args: ['a', new DBusUint32(7)], wire: hex('01000000 6100 017500 000000 07000000'), decoded: ['a', 7], encodeBug: VARIANT_ARGUMENT_BUG},
    {signature: 'ssv', args: ['a', 'b', 'c'], wire: hex('01000000 6100 0000 01000000 6200 017300 000000 01000000 6300')}
]
