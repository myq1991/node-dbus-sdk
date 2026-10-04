import {beforeEach, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import v8 from 'node:v8'
import vm from 'node:vm'
import {DBus} from '../../DBus'
import {DBusConnection} from '../../lib/DBusConnection'
import {DBusMessage} from '../../lib/DBusMessage'
import {DBusSignalEmitter} from '../../lib/DBusSignalEmitter'
import {DBusMessageType} from '../../lib/enums/DBusMessageType'
import {DBusMessageFlags} from '../../lib/enums/DBusMessageFlags'
import {MockBusStream} from '../helpers/MockBusStream'
import {knownBug} from '../helpers/KnownBug'
import {withTimeout} from '../helpers/Async'
import {undecodableMessage} from '../helpers/WireMessage'

v8.setFlagsFromString('--expose-gc')
const gc: () => void = vm.runInNewContext('gc')

let serverSerial: number = 1000

function methodReturn(replySerial: number, signature?: string, ...body: any[]): Buffer {
    return DBusMessage.encode({
        serial: serverSerial++,
        replySerial: replySerial,
        type: DBusMessageType.METHOD_RETURN,
        flags: DBusMessageFlags.NO_REPLY_EXPECTED,
        sender: ':1.1',
        signature: signature
    }, ...body)
}

function errorReply(replySerial: number, errorName: string, text: string): Buffer {
    return DBusMessage.encode({
        serial: serverSerial++,
        replySerial: replySerial,
        type: DBusMessageType.ERROR,
        flags: DBusMessageFlags.NO_REPLY_EXPECTED,
        sender: ':1.1',
        errorName: errorName,
        signature: 's'
    }, text)
}

function signal(sender: string, path: string, iface: string, member: string, signature?: string, ...body: any[]): Buffer {
    return DBusMessage.encode({
        serial: serverSerial++,
        type: DBusMessageType.SIGNAL,
        flags: DBusMessageFlags.NO_REPLY_EXPECTED,
        sender: sender,
        path: path,
        interfaceName: iface,
        member: member,
        signature: signature
    }, ...body)
}

function flush(): Promise<void> {
    return new Promise<void>((resolve): NodeJS.Immediate => setImmediate(resolve))
}

describe('DBus message dispatch', (): void => {
    let stream: MockBusStream
    let dbus: DBus

    beforeEach((): void => {
        stream = new MockBusStream()
        dbus = new DBus(new DBusConnection(stream, 'EXTERNAL', '0', 'guid'))
    })

    describe('invoke', (): void => {
        it('sends a method call and resolves with the reply body', async (): Promise<void> => {
            const pending: Promise<any[]> = dbus.invoke({
                service: 'org.example',
                objectPath: '/obj',
                interface: 'org.example.I',
                method: 'Echo',
                signature: 'su',
                args: ['a', 1]
            })
            const call: DBusMessage = await stream.nextOutgoing()
            assert.equal(call.header.type, DBusMessageType.METHOD_CALL)
            assert.equal(call.header.destination, 'org.example')
            assert.equal(call.header.path, '/obj')
            assert.equal(call.header.interfaceName, 'org.example.I')
            assert.equal(call.header.member, 'Echo')
            assert.deepEqual(call.body, ['a', 1])
            stream.deliver(methodReturn(call.header.serial, 'su', 'b', 2))
            assert.deepEqual(await pending, ['b', 2])
        })

        it('rejects with the DBus error name and message', async (): Promise<void> => {
            const pending: Promise<any[]> = dbus.invoke({service: 'org.example', objectPath: '/', interface: 'org.example.I', method: 'Fail'})
            const call: DBusMessage = await stream.nextOutgoing()
            stream.deliver(errorReply(call.header.serial, 'org.example.Error.Nope', 'nope'))
            await assert.rejects(pending, {name: 'org.example.Error.Nope', message: 'nope'})
        })

        it('matches concurrent replies to their calls by serial', async (): Promise<void> => {
            const first: Promise<any[]> = dbus.invoke({service: 'org.example', objectPath: '/', interface: 'org.example.I', method: 'A'})
            const second: Promise<any[]> = dbus.invoke({service: 'org.example', objectPath: '/', interface: 'org.example.I', method: 'B'})
            const callA: DBusMessage = await stream.nextOutgoing()
            const callB: DBusMessage = await stream.nextOutgoing()
            stream.deliver(methodReturn(callB.header.serial, 's', 'for B'))
            stream.deliver(methodReturn(callA.header.serial, 's', 'for A'))
            assert.deepEqual(await first, ['for A'])
            assert.deepEqual(await second, ['for B'])
        })

        it('marks no-reply calls with NO_REPLY_EXPECTED', async (): Promise<void> => {
            const result: void = dbus.invoke({service: 'org.example', objectPath: '/', interface: 'org.example.I', method: 'Fire'}, true)
            assert.equal(result, undefined)
            const call: DBusMessage = await stream.nextOutgoing()
            assert.equal(call.header.flags & DBusMessageFlags.NO_REPLY_EXPECTED, DBusMessageFlags.NO_REPLY_EXPECTED)
        })

        it('ignores replies to unknown serials', async (): Promise<void> => {
            stream.deliver(methodReturn(99999, 's', 'stray'))
            await flush()
        })

        it('rejects pending calls when the connection closes', async (): Promise<void> => {
            const pending: Promise<any[]> = dbus.invoke({service: 'org.example', objectPath: '/', interface: 'org.example.I', method: 'Slow'})
            await stream.nextOutgoing()
            stream.destroy()
            await assert.rejects(withTimeout(pending, 500, 'pending call'), {name: 'org.freedesktop.DBus.Error.Disconnected'})
        })

        it('rejects a call whose reply cannot be decoded', async (): Promise<void> => {
            const pending: Promise<any[]> = dbus.invoke({service: 'org.example', objectPath: '/', interface: 'org.example.I', method: 'Broken'})
            const call: DBusMessage = await stream.nextOutgoing()
            stream.deliver(undecodableMessage({serial: serverSerial++, replySerial: call.header.serial, type: DBusMessageType.METHOD_RETURN, flags: DBusMessageFlags.NO_REPLY_EXPECTED, sender: ':1.1'}))
            await assert.rejects(withTimeout(pending, 500, 'pending call'), {code: 'E_MESSAGE_DECODE'})
        })

        it('rejects a call that cannot be encoded', async (): Promise<void> => {
            await assert.rejects(withTimeout(dbus.invoke({service: 'org.example', objectPath: '/', interface: 'org.example.I', method: 'Typed', signature: 'o', args: ['not an object path']}) as Promise<any[]>, 500, 'call'), {code: 'E_OBJECT_PATH'})
        })

        it('rejects a call made after the connection closed', async (): Promise<void> => {
            stream.destroy()
            await flush()
            await assert.rejects(dbus.invoke({service: 'org.example', objectPath: '/', interface: 'org.example.I', method: 'Late'}), {name: 'org.freedesktop.DBus.Error.Disconnected'})
        })

        it('releases completed calls', async (): Promise<void> => {
            const control: WeakRef<object> = ((): WeakRef<object> => new WeakRef({}))()
            const completed: WeakRef<Promise<any[]>> = await (async (): Promise<WeakRef<Promise<any[]>>> => {
                const pending: Promise<any[]> = dbus.invoke({service: 'org.example', objectPath: '/', interface: 'org.example.I', method: 'Ping'})
                const call: DBusMessage = await stream.nextOutgoing()
                stream.deliver(methodReturn(call.header.serial))
                await pending
                return new WeakRef(pending)
            })()
            await flush()
            gc()
            await flush()
            gc()
            assert.equal(control.deref(), undefined, 'garbage collection did not run; the leak check is inconclusive')
            assert.equal(completed.deref(), undefined)
        })
    })

    describe('signals', (): void => {
        it('registers a match rule when a listener is added', async (): Promise<void> => {
            const emitter: DBusSignalEmitter = dbus.createSignalEmitter({service: 'org.example', uniqueName: ':1.9', objectPath: '/obj', interface: 'org.example.I'})
            emitter.on('Changed', (): void => undefined)
            const addMatch: DBusMessage = await stream.nextOutgoing()
            assert.equal(addMatch.header.member, 'AddMatch')
            assert.deepEqual(addMatch.body, ['type=signal,sender=:1.9,path=/obj,interface=org.example.I,member=Changed'])
        })

        it('delivers matching signals to listeners', async (): Promise<void> => {
            const emitter: DBusSignalEmitter = dbus.createSignalEmitter({service: 'org.example', uniqueName: ':1.9', objectPath: '/obj', interface: 'org.example.I'})
            const received: any[][] = []
            emitter.on('Changed', (...args: any[]): number => received.push(args))
            stream.deliver(signal(':1.9', '/obj', 'org.example.I', 'Changed', 'su', 'x', 1))
            stream.deliver(signal(':1.8', '/obj', 'org.example.I', 'Changed', 'su', 'other sender', 1))
            stream.deliver(signal(':1.9', '/other', 'org.example.I', 'Changed', 'su', 'other path', 1))
            stream.deliver(signal(':1.9', '/obj', 'org.example.Other', 'Changed', 'su', 'other interface', 1))
            stream.deliver(signal(':1.9', '/obj', 'org.example.I', 'Unrelated', 'su', 'other member', 1))
            await flush()
            assert.deepEqual(received, [['x', 1]])
        })

        it('delivers every signal to a wildcard listener', async (): Promise<void> => {
            const emitter: DBusSignalEmitter = dbus.createSignalEmitter({service: '*', uniqueName: '*', objectPath: '*', interface: '*'})
            const received: string[] = []
            emitter.on('*', (name: string): number => received.push(name))
            stream.deliver(signal(':1.9', '/a', 'org.example.I', 'One'))
            stream.deliver(signal(':1.7', '/b', 'org.example.J', 'Two'))
            await flush()
            assert.deepEqual(received, ['One', 'Two'])
        })
    })

    describe('undecodable incoming method calls', (): void => {
        it('answers with InvalidArgs instead of leaving the caller waiting', async (): Promise<void> => {
            stream.deliver(undecodableMessage({serial: 77, type: DBusMessageType.METHOD_CALL, flags: DBusMessageFlags.REPLY_EXPECTED, sender: ':1.3', path: '/obj', interfaceName: 'org.example.I', member: 'Do'}))
            const reply: DBusMessage = await withTimeout(stream.nextOutgoing(), 500, 'reply')
            assert.equal(reply.header.type, DBusMessageType.ERROR)
            assert.equal(reply.header.errorName, 'org.freedesktop.DBus.Error.InvalidArgs')
            assert.equal(reply.header.replySerial, 77)
            assert.equal(reply.header.destination, ':1.3')
        })
    })

    describe('outgoing messages', (): void => {
        it('emits a method call event for incoming calls', async (): Promise<void> => {
            const calls: DBusMessage[] = []
            dbus.on('methodCall', (message: DBusMessage): number => calls.push(message))
            stream.deliver(DBusMessage.encode({serial: 5, sender: ':1.3', path: '/obj', interfaceName: 'org.example.I', member: 'Do', signature: 's'}, 'arg'))
            await flush()
            assert.equal(calls.length, 1)
            assert.equal(calls[0].header.member, 'Do')
            assert.deepEqual(calls[0].body, ['arg'])
        })

        it('sends replies addressed to the caller', async (): Promise<void> => {
            dbus.reply({destination: ':1.3', replySerial: 5, signature: 's', data: ['ok']})
            const reply: DBusMessage = await stream.nextOutgoing()
            assert.equal(reply.header.type, DBusMessageType.METHOD_RETURN)
            assert.equal(reply.header.destination, ':1.3')
            assert.equal(reply.header.replySerial, 5)
            assert.deepEqual(reply.body, ['ok'])
        })

        it('sends error replies', async (): Promise<void> => {
            const error: Error = new Error('bad input')
            error.name = 'org.example.Error.Invalid'
            dbus.reply({destination: ':1.3', replySerial: 6, data: error})
            const reply: DBusMessage = await stream.nextOutgoing()
            assert.equal(reply.header.type, DBusMessageType.ERROR)
            assert.equal(reply.header.errorName, 'org.example.Error.Invalid')
            assert.deepEqual(reply.body, ['bad input'])
        })

        it('emits signals', async (): Promise<void> => {
            dbus.emitSignal({objectPath: '/obj', interface: 'org.example.I', signal: 'Changed', signature: 'u', data: [3]})
            const message: DBusMessage = await stream.nextOutgoing()
            assert.equal(message.header.type, DBusMessageType.SIGNAL)
            assert.equal(message.header.member, 'Changed')
            assert.deepEqual(message.body, [3])
        })
    })
})
