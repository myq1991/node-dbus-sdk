import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import EventEmitter from 'node:events'
import {DBus} from '../../DBus'
import {DBusSignalEmitter} from '../../lib/DBusSignalEmitter'
import {LocalInterface} from '../../LocalInterface'
import {LocalObject} from '../../LocalObject'
import {PrivateBus} from '../helpers/PrivateBus'
import {nextEvent, withTimeout} from '../helpers/Async'

const PATH: string = '/org/example/Signals'
const INTERFACE: string = 'org.example.Signals'

/**
 * Signals sent with DBus.emitSignal and received through createSignalEmitter, across a real dbus-daemon.
 */
describe('signals across the bus', {skip: !PrivateBus.available && 'dbus-daemon not found', timeout: 30000}, (): void => {
    let bus: PrivateBus
    let sender: DBus
    let firstReceiver: DBus
    let secondReceiver: DBus

    before(async (): Promise<void> => {
        bus = await PrivateBus.start()
        ;[sender, firstReceiver, secondReceiver] = await Promise.all([1, 2, 3].map((): Promise<DBus> => withTimeout(DBus.connect({busAddress: bus.address}), 3000, 'connect')))
    })

    after(async (): Promise<void> => {
        await Promise.all([sender, firstReceiver, secondReceiver].map((connection: DBus): Promise<void> => withTimeout(connection.disconnect(), 2000, 'disconnect').catch((): void => undefined)))
        await bus.stop()
    })

    function listen(receiver: DBus, objectPath: string = PATH): DBusSignalEmitter {
        return receiver.createSignalEmitter({service: sender.uniqueName, uniqueName: sender.uniqueName, objectPath, interface: INTERFACE})
    }

    /**
     * Round trips through the daemon so that AddMatch calls sent before are active.
     */
    async function sync(): Promise<void> {
        await Promise.all([firstReceiver, secondReceiver].map((receiver: DBus): Promise<string[]> => withTimeout(receiver.listNames(), 2000, 'sync')))
    }

    it('delivers a broadcast signal to every subscriber', async (): Promise<void> => {
        const first: Promise<any[]> = nextEvent(listen(firstReceiver), 'Broadcast')
        const second: Promise<any[]> = nextEvent(listen(secondReceiver), 'Broadcast')
        await sync()
        sender.emitSignal({objectPath: PATH, interface: INTERFACE, signal: 'Broadcast', signature: 's', data: ['to everyone']})
        assert.deepEqual(await first, ['to everyone'])
        assert.deepEqual(await second, ['to everyone'])
    })

    it('delivers a unicast signal only to its destination', async (): Promise<void> => {
        const firstSignals: DBusSignalEmitter = listen(firstReceiver)
        const secondSignals: DBusSignalEmitter = listen(secondReceiver)
        const first: Promise<any[]> = nextEvent(firstSignals, 'Notify')
        const second: Promise<any[]> = nextEvent(secondSignals, 'Notify')
        await sync()
        sender.emitSignal({objectPath: PATH, interface: INTERFACE, signal: 'Notify', signature: 's', destination: firstReceiver.uniqueName, data: ['only for the first']})
        // A broadcast sent afterwards arrives after the unicast one would have, so it is what the second receiver sees first
        sender.emitSignal({objectPath: PATH, interface: INTERFACE, signal: 'Notify', signature: 's', data: ['for everyone']})
        assert.deepEqual(await first, ['only for the first'])
        assert.deepEqual(await second, ['for everyone'])
    })

    it('delivers signal arguments of several types', async (): Promise<void> => {
        const received: Promise<any[]> = nextEvent(listen(firstReceiver), 'Typed')
        await sync()
        sender.emitSignal({objectPath: PATH, interface: INTERFACE, signal: 'Typed', signature: 'sua{sv}', data: ['name', 7, {flag: true, nested: {list: ['a']}}]})
        assert.deepEqual(await received, ['name', 7, {flag: true, nested: {list: ['a']}}])
    })

    it('delivers a signal without arguments', async (): Promise<void> => {
        const received: Promise<any[]> = nextEvent(listen(firstReceiver), 'Empty')
        await sync()
        sender.emitSignal({objectPath: PATH, interface: INTERFACE, signal: 'Empty'})
        assert.deepEqual(await received, [])
    })

    it('delivers signals from any object path to a wildcard subscriber', async (): Promise<void> => {
        const signals: DBusSignalEmitter = listen(firstReceiver, '*')
        const paths: string[] = []
        const both: Promise<void> = withTimeout(new Promise<void>((resolve): void => {
            signals.on('Moved', (objectPath: string): void => {
                paths.push(objectPath)
                if (paths.length === 2) resolve()
            })
        }), 3000, 'two signals')
        await sync()
        sender.emitSignal({objectPath: '/org/example/One', interface: INTERFACE, signal: 'Moved', signature: 's', data: ['/org/example/One']})
        sender.emitSignal({objectPath: '/org/example/Two', interface: INTERFACE, signal: 'Moved', signature: 's', data: ['/org/example/Two']})
        await both
        assert.deepEqual(paths, ['/org/example/One', '/org/example/Two'])
    })

    it('ignores LocalInterface signals emitted before the service runs', (): void => {
        const events: EventEmitter = new EventEmitter()
        const object: LocalObject = new LocalObject(PATH)
        object.addInterface(new LocalInterface(INTERFACE).defineSignal({name: 'Early', args: [{name: 'value', type: 's'}], eventEmitter: events}))
        assert.doesNotThrow((): boolean => events.emit('Early', 'too early'))
    })
})
