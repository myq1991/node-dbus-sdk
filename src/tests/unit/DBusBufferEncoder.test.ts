import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBusBufferEncoder} from '../../lib/DBusBufferEncoder'
import {DBusMessageEndianness} from '../../lib/enums/DBusMessageEndianness'
import {InvalidValueError, ObjectPathError, SignatureError} from '../../lib/Errors'
import {DBusSignedValue} from '../../lib/DBusSignedValue'
import {DBusBufferDecoder} from '../../lib/DBusBufferDecoder'
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

    describe('variant type inference', (): void => {
        const encode = (signature: string, value: any): string => new DBusBufferEncoder().encode(signature, value).toString('hex')

        /**
         * A plain value given for a variant must encode exactly as the same value with its type given explicitly.
         */
        const cases: [string, any, string, any][] = [
            ['an integer within INT32', 7, 'i', 7],
            ['an integer beyond INT32', 1700000000000, 'x', 1700000000000n],
            ['a negative integer beyond INT32', -(2 ** 40), 'x', -(2n ** 40n)],
            ['a float', 0.25, 'd', 0.25],
            ['an integer beyond the safe range', 2 ** 60, 'd', 2 ** 60],
            ['integers that all fit INT32', [1, -2], 'ai', [1, -2]],
            ['integers of which one exceeds INT32', [1, 2 ** 40], 'ax', [1n, 2n ** 40n]],
            ['integers and floats', [1, 1.5], 'ad', [1, 1.5]],
            ['objects', [{a: 'x'}, {b: 'y'}], 'aa{sv}', [{a: new DBusSignedValue('s', 'x')}, {b: new DBusSignedValue('s', 'y')}]]
        ]
        for (const [label, plain, signature, explicit] of cases) {
            it(`infers ${signature} for ${label}`, (): void => {
                assert.equal(encode('v', plain), encode('v', new DBusSignedValue(signature, explicit)))
            })
        }

        it('keeps every object of an array instead of merging them', (): void => {
            const body: Buffer = new DBusBufferEncoder().encode('v', [{a: 1}, {b: 2}])
            assert.deepEqual(new DBusBufferDecoder(DBusMessageEndianness.LE, body).decode('v'), [[{a: 1}, {b: 2}]])
        })

        for (const [label, value] of [['null', null], ['undefined', undefined], ['a function', (): void => undefined]] as [string, any][]) {
            it(`rejects ${label}, which has no DBus type`, (): void => {
                assert.throws((): Buffer => new DBusBufferEncoder().encode('v', value), (error: unknown): boolean => error instanceof InvalidValueError && error.name === 'InvalidValueError' && /Cannot infer a DBus type/.test(error.message))
            })
        }
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
