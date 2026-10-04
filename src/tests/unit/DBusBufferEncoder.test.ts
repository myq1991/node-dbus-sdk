import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBusBufferEncoder} from '../../lib/DBusBufferEncoder'
import {DBusMessageEndianness} from '../../lib/enums/DBusMessageEndianness'
import {ObjectPathError, SignatureError} from '../../lib/Errors'
import {DBusUInt32} from '../../lib/datatypes/DBusUInt32'
import {DBusInt64} from '../../lib/datatypes/DBusInt64'
import {WireVector, WireVectors} from '../fixtures/WireVectors'
import {LibdbusMessageFixture, LibdbusMessages} from '../fixtures/LibdbusMessages'
import {wireMessageBody} from '../helpers/WireMessage'
import {knownBug} from '../helpers/KnownBug'
import {hex} from '../helpers/Hex'

function encode(signature: string, args: any[], endianness: DBusMessageEndianness = DBusMessageEndianness.LE): Buffer {
    return new DBusBufferEncoder(endianness).encode(signature, args.length > 1 ? args : args[0])
}

describe('DBusBufferEncoder', (): void => {

    describe('wire format per DBus specification', (): void => {
        WireVectors.forEach((vector: WireVector): void => {
            const title: string = `${vector.signature} ${JSON.stringify(vector.args, (_k: string, v: any): any => typeof v === 'bigint' ? `${v}n` : v)}`
            it(title, vector.encodeBug ? knownBug(vector.encodeBug) : {}, (): void => {
                assert.equal(encode(vector.signature, vector.args).toString('hex'), vector.wire.toString('hex'))
            })
        })
    })

    describe('matches libdbus encoding byte-for-byte', (): void => {
        LibdbusMessages.forEach((fixture: LibdbusMessageFixture): void => {
            it(fixture.name, fixture.encodeBug ? knownBug(fixture.encodeBug) : {}, (): void => {
                assert.equal(encode(fixture.signature, fixture.body).toString('hex'), wireMessageBody(fixture.raw).toString('hex'))
            })
        })
    })

    describe('big-endian', (): void => {
        it('writes integers most significant byte first', (): void => {
            assert.equal(encode('u', [1], DBusMessageEndianness.BE).toString('hex'), '00000001')
            assert.equal(encode('x', [1n], DBusMessageEndianness.BE).toString('hex'), '0000000000000001')
        })

        it('writes string length big-endian', (): void => {
            assert.equal(encode('s', ['a'], DBusMessageEndianness.BE).toString('hex'), hex('00000001 6100').toString('hex'))
        })
    })

    describe('explicit type classes', (): void => {
        it('uses the type of a DBusTypeClass inside a variant', (): void => {
            assert.equal(encode('v', [new DBusUInt32(7)]).toString('hex'), hex('01 7500 00 07000000').toString('hex'))
            assert.equal(encode('v', [new DBusInt64(7n)]).toString('hex'), hex('01 7800 0000000000 0700000000000000').toString('hex'))
        })
    })

    describe('byte arrays', (): void => {
        it('encodes a Uint8Array', (): void => {
            assert.equal(encode('ay', [new Uint8Array([1, 2, 3])]).toString('hex'), '03000000010203')
        })

        it('encodes only the bytes of a Buffer slice', (): void => {
            const slice: Buffer = Buffer.from([9, 1, 2, 3, 9]).subarray(1, 4)
            assert.equal(encode('ay', [slice]).toString('hex'), '03000000010203')
        })

        it('encodes a Uint8Array inside a variant as ay', (): void => {
            assert.equal(encode('v', [new Uint8Array([1, 2])]).toString('hex'), hex('02 617900 02000000 0102').toString('hex'))
        })
    })

    describe('validation', (): void => {
        it('rejects an invalid object path', (): void => {
            assert.throws((): Buffer => encode('o', ['no-leading-slash']), ObjectPathError)
            assert.throws((): Buffer => encode('o', ['/trailing/']), ObjectPathError)
        })

        it('rejects a signature longer than 255 bytes', (): void => {
            assert.throws((): Buffer => encode('g', ['y'.repeat(256)]), SignatureError)
        })

        it('rejects a non-array value for an array signature', (): void => {
            assert.throws((): Buffer => encode('ai', ['not an array']), SignatureError)
        })

        it('rejects a struct with the wrong number of fields', (): void => {
            assert.throws((): Buffer => encode('(ii)', [[1]]), SignatureError)
        })

        it('rejects an unknown type code', (): void => {
            assert.throws((): Buffer => encode('z', [1]), SignatureError)
        })
    })
})
