import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBusMessage} from '../../lib/DBusMessage'
import {DBusMessageType} from '../../lib/enums/DBusMessageType'
import {DBusMessageFlags} from '../../lib/enums/DBusMessageFlags'
import {DBusMessageEndianness} from '../../lib/enums/DBusMessageEndianness'
import {SerialError} from '../../lib/Errors'
import {LibdbusMessageFixture, LibdbusMessages} from '../fixtures/LibdbusMessages'
import {decodeWireMessage} from '../helpers/WireMessage'
import {knownBug} from '../helpers/KnownBug'

describe('DBusMessage', (): void => {

    describe('encoding', (): void => {
        const raw: Buffer = DBusMessage.encode({
            serial: 42,
            type: DBusMessageType.METHOD_CALL,
            flags: DBusMessageFlags.REPLY_EXPECTED,
            destination: 'org.example.Service',
            path: '/org/example/Object',
            interfaceName: 'org.example.Interface',
            member: 'DoThing',
            signature: 'sa{sv}'
        }, 'hello', {answer: 42})

        it('writes the fixed header', (): void => {
            assert.equal(raw[0], DBusMessageEndianness.LE)
            assert.equal(raw[1], DBusMessageType.METHOD_CALL)
            assert.equal(raw[2], DBusMessageFlags.REPLY_EXPECTED)
            assert.equal(raw[3], 1)
            assert.equal(raw.readUInt32LE(8), 42)
        })

        it('pads the header fields so the body starts on an 8-byte boundary', (): void => {
            const fieldsLength: number = raw.readUInt32LE(12)
            const bodyLength: number = raw.readUInt32LE(4)
            const bodyOffset: number = 16 + Math.ceil(fieldsLength / 8) * 8
            assert.equal(bodyOffset % 8, 0)
            assert.equal(raw.length, bodyOffset + bodyLength)
        })

        it('round-trips header fields and body', (): void => {
            const message: DBusMessage = decodeWireMessage(raw)
            assert.equal(message.header.serial, 42)
            assert.equal(message.header.destination, 'org.example.Service')
            assert.equal(message.header.path, '/org/example/Object')
            assert.equal(message.header.interfaceName, 'org.example.Interface')
            assert.equal(message.header.member, 'DoThing')
            assert.equal(message.header.signature, 'sa{sv}')
            assert.deepEqual(message.body, ['hello', {answer: 42}])
        })

        it('encodes a message without body', (): void => {
            const message: DBusMessage = decodeWireMessage(DBusMessage.encode({serial: 1, path: '/', member: 'Ping'}))
            assert.equal(message.header.member, 'Ping')
            assert.deepEqual(message.body, [])
        })

        it('round-trips an error reply', (): void => {
            const message: DBusMessage = decodeWireMessage(DBusMessage.encode({
                serial: 7,
                replySerial: 3,
                type: DBusMessageType.ERROR,
                flags: DBusMessageFlags.NO_REPLY_EXPECTED,
                errorName: 'org.example.Error.Failed',
                destination: ':1.5',
                signature: 's'
            }, 'went wrong'))
            assert.equal(message.header.type, DBusMessageType.ERROR)
            assert.equal(message.header.replySerial, 3)
            assert.equal(message.header.errorName, 'org.example.Error.Failed')
            assert.deepEqual(message.body, ['went wrong'])
        })

        it('requires a serial', (): void => {
            assert.throws((): Buffer => new DBusMessage({serial: 0}).toBuffer(), SerialError)
        })
    })

    describe('decoding libdbus messages', (): void => {
        LibdbusMessages.forEach((fixture: LibdbusMessageFixture): void => {
            it(fixture.name, fixture.decodeBug ? knownBug(fixture.decodeBug) : {}, (): void => {
                const message: DBusMessage = decodeWireMessage(fixture.raw)
                assert.equal(message.header.type, DBusMessageType.SIGNAL)
                assert.equal(message.header.path, '/test')
                assert.equal(message.header.interfaceName, 'test.Golden')
                assert.equal(message.header.signature, fixture.signature)
                assert.match(message.header.sender, /^:1\.\d+$/)
                assert.deepEqual(message.body, fixture.body)
            })
        })
    })
})
