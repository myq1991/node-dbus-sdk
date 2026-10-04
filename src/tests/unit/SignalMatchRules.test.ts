import {beforeEach, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBus} from '../../DBus'
import {DBusConnection} from '../../lib/DBusConnection'
import {DBusMessage} from '../../lib/DBusMessage'
import {DBusSignalEmitter} from '../../lib/DBusSignalEmitter'
import {DBusMessageType} from '../../lib/enums/DBusMessageType'
import {DBusMessageFlags} from '../../lib/enums/DBusMessageFlags'
import {MockBusStream} from '../helpers/MockBusStream'
import {decodeWireMessage} from '../helpers/WireMessage'
import {knownBug} from '../helpers/KnownBug'

const RULE: string = 'type=signal,sender=:1.9,path=/obj,interface=org.example.I,member=Changed'

const REMOVE_MATCH_BUG: string = 'removing listeners never sends RemoveMatch, so the bus keeps routing the signals to the connection'

let serial: number = 5000

function changedSignal(): Buffer {
    return DBusMessage.encode({
        serial: serial++,
        type: DBusMessageType.SIGNAL,
        flags: DBusMessageFlags.NO_REPLY_EXPECTED,
        sender: ':1.9',
        path: '/obj',
        interfaceName: 'org.example.I',
        member: 'Changed',
        signature: 's'
    }, 'payload')
}

function flush(): Promise<void> {
    return new Promise<void>((resolve): NodeJS.Immediate => setImmediate(resolve))
}

describe('signal match rules', (): void => {
    let stream: MockBusStream
    let dbus: DBus

    beforeEach((): void => {
        stream = new MockBusStream()
        dbus = new DBus(new DBusConnection(stream, 'EXTERNAL', '0', 'guid'))
    })

    function emitter(): DBusSignalEmitter {
        return dbus.createSignalEmitter({service: 'org.example', uniqueName: ':1.9', objectPath: '/obj', interface: 'org.example.I'})
    }

    /**
     * Rules sent to the bus with the given method (AddMatch or RemoveMatch), in order.
     */
    function rulesSent(method: 'AddMatch' | 'RemoveMatch'): string[] {
        return stream.written.map(decodeWireMessage)
            .filter((message: DBusMessage): boolean => message.header.member === method)
            .map((message: DBusMessage): string => message.body[0])
    }

    /**
     * How many registrations of RULE the bus holds for this connection (the bus counts identical rules separately).
     */
    function activeRegistrations(): number {
        return rulesSent('AddMatch').filter((rule: string): boolean => rule === RULE).length - rulesSent('RemoveMatch').filter((rule: string): boolean => rule === RULE).length
    }

    it('adds a match rule for the first listener', async (): Promise<void> => {
        emitter().on('Changed', (): void => undefined)
        await flush()
        assert.deepEqual(rulesSent('AddMatch'), [RULE])
    })

    it('removes the match rule when the last listener is removed', knownBug(REMOVE_MATCH_BUG), async (): Promise<void> => {
        const signals: DBusSignalEmitter = emitter()
        const listener = (): void => undefined
        signals.on('Changed', listener)
        signals.off('Changed', listener)
        await flush()
        assert.equal(activeRegistrations(), 0)
    })

    it('removes as many registrations as it added', knownBug(REMOVE_MATCH_BUG), async (): Promise<void> => {
        const signals: DBusSignalEmitter = emitter()
        const first = (): void => undefined
        const second = (): void => undefined
        signals.on('Changed', first)
        signals.on('Changed', second)
        signals.removeListener('Changed', first)
        signals.removeListener('Changed', second)
        await flush()
        assert.equal(activeRegistrations(), 0)
    })

    it('removes the match rule after a once listener has fired', knownBug(REMOVE_MATCH_BUG), async (): Promise<void> => {
        emitter().once('Changed', (): void => undefined)
        stream.deliver(changedSignal())
        await flush()
        assert.equal(activeRegistrations(), 0)
    })

    it('removes the match rules on removeAllListeners', knownBug(REMOVE_MATCH_BUG), async (): Promise<void> => {
        const signals: DBusSignalEmitter = emitter()
        signals.on('Changed', (): void => undefined)
        signals.removeAllListeners()
        await flush()
        assert.equal(activeRegistrations(), 0)
    })

    it('keeps the rule while another emitter still listens', async (): Promise<void> => {
        const first: DBusSignalEmitter = emitter()
        const second: DBusSignalEmitter = emitter()
        const listener = (): void => undefined
        first.on('Changed', listener)
        second.on('Changed', (): void => undefined)
        first.off('Changed', listener)
        await flush()
        assert.ok(activeRegistrations() >= 1)
    })

    it('stops delivering a signal to a removed listener', async (): Promise<void> => {
        const signals: DBusSignalEmitter = emitter()
        const received: string[] = []
        const listener = (value: string): number => received.push(value)
        signals.on('Changed', listener)
        stream.deliver(changedSignal())
        await flush()
        signals.off('Changed', listener)
        stream.deliver(changedSignal())
        await flush()
        assert.deepEqual(received, ['payload'])
    })

    it('drops the rule of a signal that arrives when nobody listens anymore', async (): Promise<void> => {
        const signals: DBusSignalEmitter = emitter()
        const listener = (): void => undefined
        signals.on('Changed', listener)
        signals.off('Changed', listener)
        stream.deliver(changedSignal())
        await flush()
        assert.ok(rulesSent('RemoveMatch').includes(RULE))
    })
})
