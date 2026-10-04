import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBusConnection} from '../../lib/DBusConnection'
import {DBusMessage} from '../../lib/DBusMessage'
import {DBusMessageType} from '../../lib/enums/DBusMessageType'
import {DBusMessageFlags} from '../../lib/enums/DBusMessageFlags'
import {DBusMessageEndianness} from '../../lib/enums/DBusMessageEndianness'
import {DBusBufferEncoder} from '../../lib/DBusBufferEncoder'
import {DBusSignedValue} from '../../lib/DBusSignedValue'
import {MockBusStream} from '../helpers/MockBusStream'
import {LibdbusMessages} from '../fixtures/LibdbusMessages'
import {knownBug} from '../helpers/KnownBug'
import {DBusByte} from '../../lib/datatypes/DBusByte'
import {DBusArray} from '../../lib/datatypes/DBusArray'
import {DBusVariant} from '../../lib/datatypes/DBusVariant'

function createConnection(): { stream: MockBusStream, connection: DBusConnection, received: DBusMessage[] } {
    const stream: MockBusStream = new MockBusStream()
    const connection: DBusConnection = new DBusConnection(stream, 'EXTERNAL', '0', 'guid')
    const received: DBusMessage[] = []
    connection.on('message', (message: DBusMessage): number => received.push(message))
    return {stream, connection, received}
}

/**
 * Waits for queued stream events to be processed.
 */
function flush(): Promise<void> {
    return new Promise<void>((resolve): NodeJS.Immediate => setImmediate(resolve))
}

const basic: Buffer = LibdbusMessages[0].raw
const dict: Buffer = LibdbusMessages[2].raw

describe('DBusConnection framing', (): void => {

    it('emits a message delivered in one chunk', async (): Promise<void> => {
        const {stream, received} = createConnection()
        stream.deliver(basic)
        await flush()
        assert.equal(received.length, 1)
        assert.equal(received[0].header.member, 'Basic')
    })

    it('emits several messages delivered in one chunk', async (): Promise<void> => {
        const {stream, received} = createConnection()
        stream.deliver(Buffer.concat([basic, dict, basic]))
        await flush()
        assert.deepEqual(received.map((message: DBusMessage): string => message.header.member), ['Basic', 'Dict', 'Basic'])
    })

    it('reassembles a message delivered byte by byte', async (): Promise<void> => {
        const {stream, received} = createConnection()
        for (const byte of basic) {
            stream.deliver(Buffer.from([byte]))
            await flush()
        }
        assert.equal(received.length, 1)
        assert.deepEqual(received[0].body, LibdbusMessages[0].body)
    })

    it('reassembles messages split across chunk boundaries', async (): Promise<void> => {
        const {stream, received} = createConnection()
        const data: Buffer = Buffer.concat([basic, dict])
        for (const cut of [3, 17, basic.length - 1, basic.length + 20]) {
            received.length = 0
            stream.deliver(data.subarray(0, cut))
            await flush()
            stream.deliver(data.subarray(cut))
            await flush()
            assert.deepEqual(received.map((message: DBusMessage): string => message.header.member), ['Basic', 'Dict'], `cut at ${cut}`)
        }
    })

    it('frames big-endian messages', knownBug('header and body lengths are always read as little-endian'), async (): Promise<void> => {
        const {stream, received} = createConnection()
        const fields: any[] = [
            [1, new DBusSignedValue('o', '/test')],
            [3, new DBusSignedValue('s', 'Hello')],
            [8, new DBusSignedValue('g', 's')]
        ]
        const body: Buffer = new DBusBufferEncoder(DBusMessageEndianness.BE).encode('s', 'big')
        const header: Buffer = new DBusBufferEncoder(DBusMessageEndianness.BE).encode('yyyyuua(yv)', [
            DBusMessageEndianness.BE, DBusMessageType.SIGNAL, DBusMessageFlags.NO_REPLY_EXPECTED, 1, body.length, 1, fields
        ])
        const padding: Buffer = Buffer.alloc((8 - header.length % 8) % 8)
        stream.deliver(Buffer.concat([header, padding, body]))
        await flush()
        assert.equal(received.length, 1)
        assert.equal(received[0].header.member, 'Hello')
        assert.deepEqual(received[0].body, ['big'])
    })

    it('reports a message it cannot decode and keeps processing later messages', knownBug('a decoding error is thrown from the socket handler as an uncaught exception, which terminates the process'), async (): Promise<void> => {
        const {stream, connection, received} = createConnection()
        const errors: Error[] = []
        connection.on('error', (error: Error): number => errors.push(error))
        // A well-framed signal whose BOOLEAN body value is 2, which no decoder may accept: encode it as UINT32 2,
        // then change the signature header field from 'u' to 'b'
        const invalid: Buffer = DBusMessage.encode({serial: 9, type: DBusMessageType.SIGNAL, flags: DBusMessageFlags.NO_REPLY_EXPECTED, path: '/test', interfaceName: 'test.I', member: 'Invalid', signature: 'u'}, 2)
        const signatureField: number = invalid.indexOf(Buffer.from([0x08, 0x01, 0x67, 0x00, 0x01, 0x75, 0x00]))
        invalid[signatureField + 5] = 0x62
        stream.deliver(Buffer.concat([invalid, basic]))
        await flush()
        assert.equal(errors.length, 1)
        assert.deepEqual(received.map((message: DBusMessage): string => message.header.member), ['Basic'])
    })

    it('decodes bodies into DBusTypeClass instances with advancedResponse', async (): Promise<void> => {
        const stream: MockBusStream = new MockBusStream()
        const received: DBusMessage[] = []
        new DBusConnection(stream, 'EXTERNAL', '0', 'guid', true).on('message', (message: DBusMessage): number => received.push(message))
        stream.deliver(dict)
        await flush()
        const [byte, dictionary, variant] = received[0].body
        assert.ok(byte instanceof DBusByte)
        assert.ok(dictionary instanceof DBusArray)
        assert.ok(variant instanceof DBusVariant)
        assert.deepEqual([byte.value, dictionary.value, variant.value], LibdbusMessages[2].body)
    })

    it('converts 64-bit integers to numbers with convertBigIntToNumber', async (): Promise<void> => {
        const stream: MockBusStream = new MockBusStream()
        const received: DBusMessage[] = []
        new DBusConnection(stream, 'EXTERNAL', '0', 'guid', false, true).on('message', (message: DBusMessage): number => received.push(message))
        stream.deliver(basic)
        await flush()
        assert.deepEqual(received[0].body, [1, true, -2, 3, -4, 5, -6, 7, 1.5, 'hello', '/a/b'])
    })

    it('writes encoded messages to the stream', (): void => {
        const {stream, connection} = createConnection()
        const raw: Buffer = DBusMessage.encode({serial: 1, path: '/', member: 'Ping'})
        connection.write(raw)
        assert.deepEqual(stream.written, [raw])
    })
})
