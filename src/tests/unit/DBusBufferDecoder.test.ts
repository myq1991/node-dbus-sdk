import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBusBufferDecoder} from '../../lib/DBusBufferDecoder'
import {DBusBufferEncoder} from '../../lib/DBusBufferEncoder'
import {DBusMessageEndianness} from '../../lib/enums/DBusMessageEndianness'
import {AlignmentError, InvalidValueError, ReadBufferError} from '../../lib/Errors'
import {DBusTypeClass} from '../../lib/DBusTypeClass'
import {DBusInt64} from '../../lib/datatypes/DBusInt64'
import {DBusArray} from '../../lib/datatypes/DBusArray'
import {DBusByte} from '../../lib/datatypes/DBusByte'
import {WireVector, WireVectors} from '../fixtures/WireVectors'
import {LibdbusMessageFixture, LibdbusMessages} from '../fixtures/LibdbusMessages'
import {wireMessageBody} from '../helpers/WireMessage'
import {knownBug} from '../helpers/KnownBug'
import {hex} from '../helpers/Hex'

function decode(signature: string, wire: Buffer, endianness: DBusMessageEndianness = DBusMessageEndianness.LE): any[] {
    return new DBusBufferDecoder(endianness, wire).decode(signature)
}

function roundTrip(signature: string, args: any[]): any[] {
    const wire: Buffer = new DBusBufferEncoder().encode(signature, args.length > 1 ? args : args[0])
    return decode(signature, wire)
}

describe('DBusBufferDecoder', (): void => {

    describe('wire format per DBus specification', (): void => {
        WireVectors.forEach((vector: WireVector): void => {
            it(`${vector.signature} ${vector.wire.toString('hex')}`, vector.decodeBug ? knownBug(vector.decodeBug) : {}, (): void => {
                assert.deepEqual(decode(vector.signature, vector.wire), vector.decoded ? vector.decoded : vector.args)
            })
        })
    })

    describe('decodes libdbus-encoded bodies', (): void => {
        LibdbusMessages.forEach((fixture: LibdbusMessageFixture): void => {
            it(fixture.name, fixture.decodeBug ? knownBug(fixture.decodeBug) : {}, (): void => {
                assert.deepEqual(decode(fixture.signature, wireMessageBody(fixture.raw)), fixture.body)
            })
        })
    })

    describe('conversion to plain JavaScript values', (): void => {
        it('decodes a{..} into an object', (): void => {
            assert.deepEqual(roundTrip('a{sv}', [{a: 1, b: 'x'}]), [{a: 1, b: 'x'}])
        })

        it('decodes an empty a{..} into an empty object', (): void => {
            assert.deepEqual(roundTrip('a{ss}', [{}]), [{}])
        })

        it('decodes ay into a Buffer', (): void => {
            assert.deepEqual(roundTrip('ay', [Buffer.from('hello')]), [Buffer.from('hello')])
        })

        it('decodes a(..) into an array of arrays', (): void => {
            assert.deepEqual(roundTrip('a(si)', [[['a', 1], ['b', 2]]]), [[['a', 1], ['b', 2]]])
        })

        it('keeps each dictionary separate in aa{sv}', (): void => {
            assert.deepEqual(roundTrip('aa{sv}', [[{a: 1}, {b: 2}]]), [[{a: 1}, {b: 2}]])
        })

        it('keeps each buffer separate in aay', (): void => {
            assert.deepEqual(roundTrip('aay', [[Buffer.from([1]), Buffer.from([2])]]), [[Buffer.from([1]), Buffer.from([2])]])
        })

        it('keeps each dictionary separate in av', (): void => {
            assert.deepEqual(roundTrip('av', [[{a: 1}, {b: 2}]]), [[{a: 1}, {b: 2}]])
        })

        it('decodes nested containers', (): void => {
            const value: any = {list: [1, 2], nested: {deep: 'yes'}}
            assert.deepEqual(roundTrip('a{sv}', [value]), [value])
        })

        it('converts 64-bit integers to number when requested', (): void => {
            const wire: Buffer = new DBusBufferEncoder().encode('xt', [-5n, 6n])
            assert.deepEqual(new DBusBufferDecoder(DBusMessageEndianness.LE, wire, 0, true).decode('xt'), [-5, 6])
        })

        it('returns DBusTypeClass instances in typed mode', (): void => {
            const wire: Buffer = new DBusBufferEncoder().encode('xax', [5n, [1n, 2n]])
            const [int64, array] = new DBusBufferDecoder(DBusMessageEndianness.LE, wire).decode('xax', true)
            assert.ok(int64 instanceof DBusInt64)
            assert.equal(int64.value, 5n)
            assert.ok(array instanceof DBusArray)
            assert.deepEqual((array as DBusTypeClass).value, [1n, 2n])
        })
    })

    describe('byte arrays', (): void => {
        it('returns a copy that does not change with the data it was decoded from', (): void => {
            const wire: Buffer = hex('03000000 010203')
            const [bytes] = decode('ay', wire)
            wire[4] = 0xff
            assert.deepEqual(bytes, Buffer.from([1, 2, 3]))
        })

        it('returns DBusArray of DBusByte in typed mode', (): void => {
            const [array] = new DBusBufferDecoder(DBusMessageEndianness.LE, hex('03000000 010203')).decode('ay', true)
            assert.ok(array instanceof DBusArray)
            assert.ok(array.$value.every((item: any): boolean => item instanceof DBusByte))
            assert.deepEqual(array.value, Buffer.from([1, 2, 3]))
        })
    })

    describe('big-endian', (): void => {
        it('reads integers and strings most significant byte first', (): void => {
            assert.deepEqual(decode('us', hex('00000001 00000002 616200'), DBusMessageEndianness.BE), [1, 'ab'])
        })
    })

    describe('malformed input', (): void => {
        it('rejects a BOOLEAN other than 0 or 1', (): void => {
            assert.throws((): any[] => decode('b', hex('02000000')), InvalidValueError)
        })

        it('rejects a STRING without NUL terminator', (): void => {
            assert.throws((): any[] => decode('s', hex('02000000 616201')), ReadBufferError)
        })

        it('rejects a STRING whose length exceeds the buffer', (): void => {
            assert.throws((): any[] => decode('s', hex('ff000000 6162')), ReadBufferError)
        })

        it('rejects a truncated integer', (): void => {
            assert.throws((): any[] => decode('u', hex('0100')), ReadBufferError)
        })

        it('rejects alignment past the end of the buffer', (): void => {
            assert.throws((): any[] => decode('yu', hex('01')), AlignmentError)
        })
    })
})
