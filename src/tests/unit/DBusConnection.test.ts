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
import {undecodableMessage} from '../helpers/WireMessage'
import {MessageDecodeError} from '../../lib/Errors'
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

    it('frames big-endian messages', async (): Promise<void> => {
        const {stream, received} = createConnection()
        const fields: any[] = [
            [1, new DBusSignedValue('o', '/test')],
            [2, new DBusSignedValue('s', 'test.Big')],
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

    it('reports a message it cannot decode and keeps processing later messages', async (): Promise<void> => {
        const {stream, connection, received} = createConnection()
        const errors: Error[] = []
        connection.on('error', (error: Error): number => errors.push(error))
        const invalid: Buffer = undecodableMessage({serial: 9, type: DBusMessageType.SIGNAL, flags: DBusMessageFlags.NO_REPLY_EXPECTED, path: '/test', interfaceName: 'test.I', member: 'Invalid'})
        stream.deliver(Buffer.concat([invalid, basic]))
        await flush()
        assert.equal(errors.length, 1)
        assert.ok(errors[0] instanceof MessageDecodeError)
        assert.equal((errors[0] as MessageDecodeError).header?.member, 'Invalid')
        assert.deepEqual(received.map((message: DBusMessage): string => message.header.member), ['Basic'])
    })

    it('decodes bodies into type class instances with decode types all', async (): Promise<void> => {
        const stream: MockBusStream = new MockBusStream()
        const received: DBusMessage[] = []
        new DBusConnection(stream, 'EXTERNAL', '0', 'guid', {types: 'all'}).on('message', (message: DBusMessage): number => received.push(message))
        stream.deliver(dict)
        await flush()
        const [byte, dictionary, variant] = received[0].body
        assert.ok(byte instanceof DBusByte)
        assert.ok(dictionary instanceof DBusArray)
        assert.ok(variant instanceof DBusVariant)
        assert.deepEqual([byte.value, dictionary.value, variant.value], LibdbusMessages[2].body)
    })

    it('converts 64-bit integers to numbers with decode int64 number', async (): Promise<void> => {
        const stream: MockBusStream = new MockBusStream()
        const received: DBusMessage[] = []
        new DBusConnection(stream, 'EXTERNAL', '0', 'guid', {int64: 'number'}).on('message', (message: DBusMessage): number => received.push(message))
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

interface RawMessage {
    byteOrder?: number
    type?: number
    version?: number
    serial?: number
    fields?: [number, DBusSignedValue][]
    signature?: string
    body?: any[]
    declaredBodyLength?: number
}

/**
 * Builds a message byte by byte, so that it can break the rules the library's own encoder follows.
 */
function rawMessage(opts: RawMessage = {}): Buffer {
    const body: Buffer = opts.signature ? new DBusBufferEncoder().encode(opts.signature, opts.body!.length > 1 ? opts.body : opts.body![0]) : Buffer.alloc(0)
    const fields: [number, DBusSignedValue][] = opts.fields ?? [
        [1, new DBusSignedValue('o', '/test')],
        [2, new DBusSignedValue('s', 'test.Raw')],
        [3, new DBusSignedValue('s', 'Raw')],
        ...(opts.signature ? [[8, new DBusSignedValue('g', opts.signature)]] as [number, DBusSignedValue][] : [])
    ]
    const header: Buffer = new DBusBufferEncoder().encode('yyyyuua(yv)', [
        DBusMessageEndianness.LE, opts.type ?? DBusMessageType.SIGNAL, DBusMessageFlags.NO_REPLY_EXPECTED, opts.version ?? 1,
        opts.declaredBodyLength ?? body.length, opts.serial ?? 7, fields
    ])
    if (opts.byteOrder !== undefined) header[0] = opts.byteOrder
    return Buffer.concat([header, Buffer.alloc((8 - header.length % 8) % 8), body])
}

/**
 * The limits and rules of the specification on received messages, which dbus-daemon checks too but a peer-to-peer or
 * TCP connection relies on the library for.
 */
describe('DBusConnection message limits', (): void => {
    function watch(): { stream: MockBusStream, received: DBusMessage[], errors: Error[], closed: () => boolean } {
        const {stream, connection, received} = createConnection()
        const errors: Error[] = []
        let closed: boolean = false
        connection.on('error', (error: Error): number => errors.push(error))
        connection.on('close', (): void => {
            closed = true
        })
        return {stream, received, errors, closed: (): boolean => closed}
    }

    describe('close the connection for a header that cannot be trusted', (): void => {
        for (const [label, message, pattern] of [
            ['a declared length over 128 MiB', rawMessage({declaredBodyLength: 2 ** 27}).subarray(0, 16), /exceeds the maximum message length/],
            ['an invalid byte order mark', rawMessage({byteOrder: 0x00}), /Invalid byte order mark 0x00/],
            ['protocol version 2', rawMessage({version: 2}), /Unsupported protocol version 2/]
        ] as [string, Buffer, RegExp][]) {
            it(label, async (): Promise<void> => {
                const {stream, received, errors, closed} = watch()
                stream.deliver(Buffer.concat([message, rawMessage()]))
                await flush()
                assert.equal(errors.length, 1)
                assert.ok(errors[0] instanceof MessageDecodeError && pattern.test(errors[0].message), errors[0]?.message)
                assert.deepEqual(received, [])
                assert.equal(stream.destroyed, true)
                assert.equal(closed(), true)
            })
        }

        it('but accepts a declared length of exactly 128 MiB, and waits for the data', async (): Promise<void> => {
            const {stream, errors} = watch()
            const header: Buffer = rawMessage({declaredBodyLength: 0})
            const fieldsLength: number = header.readUInt32LE(12)
            stream.deliver(rawMessage({declaredBodyLength: 2 ** 27 - 16 - Math.ceil(fieldsLength / 8) * 8}).subarray(0, 16))
            await flush()
            assert.deepEqual(errors, [])
            assert.equal(stream.destroyed, false)
        })
    })

    describe('drop an invalid message and keep reading', (): void => {
        for (const [label, message, pattern] of [
            ['message type 0', rawMessage({type: 0}), /message type 0 is invalid/],
            ['serial 0', rawMessage({serial: 0}), /serial 0 is invalid/],
            ['a method call without a member', rawMessage({type: DBusMessageType.METHOD_CALL, fields: [[1, new DBusSignedValue('o', '/a')]]}), /member is missing/],
            ['a signal without an interface', rawMessage({fields: [[1, new DBusSignedValue('o', '/a')], [3, new DBusSignedValue('s', 'S')]]}), /interfaceName is missing/],
            ['a method return without a reply serial', rawMessage({type: DBusMessageType.METHOD_RETURN, fields: []}), /replySerial is missing/],
            ['an error without an error name', rawMessage({type: DBusMessageType.ERROR, fields: [[5, new DBusSignedValue('u', 3)]]}), /errorName is missing/],
            ['a header field of the wrong type', rawMessage({fields: [[1, new DBusSignedValue('s', '/a')], [2, new DBusSignedValue('s', 'a.B')], [3, new DBusSignedValue('s', 'S')]]}), /path has type 's' instead of 'o'/],
            ['a body without a signature', Buffer.concat([rawMessage({declaredBodyLength: 8}), Buffer.alloc(8)]), /has a body but no signature/],
            ['no header fields and no body at all', (() => {
                const empty: Buffer = Buffer.alloc(16)
                empty.write('l', 0)
                empty[1] = DBusMessageType.SIGNAL
                empty[3] = 1
                empty.writeUInt32LE(9, 8)
                return empty
            })(), /path is missing/]
        ] as [string, Buffer, RegExp][]) {
            it(label, async (): Promise<void> => {
                const {stream, received, errors} = watch()
                stream.deliver(Buffer.concat([message, rawMessage({signature: 's', body: ['after']})]))
                await flush()
                assert.equal(errors.length, 1, errors.map((error: Error): string => error.message).join('; '))
                assert.ok(errors[0] instanceof MessageDecodeError && pattern.test(errors[0].message), errors[0].message)
                assert.deepEqual(received.map((item: DBusMessage): any[] => item.body), [['after']])
                assert.equal(stream.destroyed, false)
            })
        }
    })

    it('passes on messages of unknown types, which receivers ignore', async (): Promise<void> => {
        const {stream, received, errors} = watch()
        stream.deliver(rawMessage({type: 5}))
        await flush()
        assert.deepEqual(errors, [])
        assert.deepEqual(received.map((item: DBusMessage): number => item.header.type), [5])
    })

    it('refuses to send a message over 128 MiB', (): void => {
        assert.throws((): Buffer => DBusMessage.encode({serial: 1, type: DBusMessageType.SIGNAL, path: '/a', interfaceName: 'a.B', member: 'S', signature: 'ay'}, Buffer.alloc(2 ** 27)), {name: 'InvalidValueError', message: /maximum message length/})
    })
})
