import {after, afterEach, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBus} from '../../DBus'
import {DBusService} from '../../DBusService'
import {DBusInterface} from '../../DBusInterface'
import {RequestNameFlags} from '../../lib/enums/RequestNameFlags'
import {RequestNameResultCode} from '../../lib/enums/RequestNameResultCode'
import {PrivateBus} from '../helpers/PrivateBus'
import {createTestService, TEST_INTERFACE, TEST_OBJECT_PATH, TestService} from '../helpers/TestService'
import {nextEvent, withTimeout} from '../helpers/Async'

/**
 * Result codes of org.freedesktop.DBus.ReleaseName (the library returns them as plain numbers).
 */
const RELEASE_NAME_REPLY_RELEASED: number = 1
const RELEASE_NAME_REPLY_NON_EXISTENT: number = 2
const RELEASE_NAME_REPLY_NOT_OWNER: number = 3

let nameCounter: number = 0

function uniqueBusName(): string {
    return `org.example.Owned${++nameCounter}`
}

/**
 * Resolves when the emitter fires `eventName` for `busName`; NameAcquired and similar events also fire for other names,
 * such as the connection's own unique name.
 */
function eventFor(emitter: DBus, eventName: string, busName: string, ms: number = 3000): Promise<any[]> {
    return withTimeout(new Promise<any[]>((resolve): void => {
        const listener = (...args: any[]): void => {
            if (args[0] !== busName) return
            emitter.off(eventName, listener)
            resolve(args)
        }
        emitter.on(eventName, listener)
    }), ms, `${eventName} ${busName}`)
}

describe('bus name ownership', {skip: !PrivateBus.available && 'dbus-daemon not found', timeout: 60000}, (): void => {
    let bus: PrivateBus
    let first: DBus
    let second: DBus
    let observer: DBus

    before(async (): Promise<void> => {
        bus = await PrivateBus.start()
        ;[first, second, observer] = await Promise.all([1, 2, 3].map((): Promise<DBus> => withTimeout(DBus.connect({busAddress: bus.address}), 3000, 'connect')))
    })

    after(async (): Promise<void> => {
        await Promise.all([first, second, observer].map((connection: DBus): Promise<void> => withTimeout(connection.disconnect(), 2000, 'disconnect').catch((): void => undefined)))
        await bus.stop()
    })

    describe('RequestName', (): void => {
        it('makes the first requester the primary owner and reports a repeated request', async (): Promise<void> => {
            const name: string = uniqueBusName()
            assert.equal(await first.requestName(name), RequestNameResultCode.DBUS_REQUEST_NAME_REPLY_PRIMARY_OWNER)
            assert.equal(await first.requestName(name), RequestNameResultCode.DBUS_REQUEST_NAME_REPLY_ALREADY_OWNER)
            assert.equal(await observer.getNameOwner(name), first.uniqueName)
        })

        it('queues a second requester and hands the name over when the owner releases it', async (): Promise<void> => {
            const name: string = uniqueBusName()
            await first.requestName(name)
            assert.equal(await second.requestName(name), RequestNameResultCode.DBUS_REQUEST_NAME_REPLY_IN_QUEUE)
            const acquired: Promise<any[]> = eventFor(second, 'NameAcquired', name)
            const replaced: Promise<any[]> = eventFor(observer, 'replaced', name)
            const ownerChanged: Promise<any[]> = eventFor(observer, 'NameOwnerChanged', name)
            assert.equal(await first.releaseName(name), RELEASE_NAME_REPLY_RELEASED)
            await acquired
            await replaced
            assert.deepEqual(await ownerChanged, [name, first.uniqueName, second.uniqueName])
            assert.equal(await observer.getNameOwner(name), second.uniqueName)
        })

        it('does not queue a requester asking for DO_NOT_QUEUE', async (): Promise<void> => {
            const name: string = uniqueBusName()
            await first.requestName(name)
            assert.equal(await second.requestName(name, RequestNameFlags.DBUS_NAME_FLAG_DO_NOT_QUEUE), RequestNameResultCode.DBUS_REQUEST_NAME_REPLY_EXISTS)
            const released: Promise<any[]> = eventFor(observer, 'offline', name)
            await first.releaseName(name)
            await released
            assert.equal(await observer.nameHasOwner(name), false)
        })

        it('lets REPLACE_EXISTING take a name whose owner allows replacement', async (): Promise<void> => {
            const name: string = uniqueBusName()
            await first.requestName(name, RequestNameFlags.DBUS_NAME_FLAG_ALLOW_REPLACEMENT)
            const lost: Promise<any[]> = eventFor(first, 'NameLost', name)
            assert.equal(await second.requestName(name, RequestNameFlags.DBUS_NAME_FLAG_REPLACE_EXISTING), RequestNameResultCode.DBUS_REQUEST_NAME_REPLY_PRIMARY_OWNER)
            await lost
            assert.equal(await observer.getNameOwner(name), second.uniqueName)
        })

        it('queues REPLACE_EXISTING when the owner does not allow replacement', async (): Promise<void> => {
            const name: string = uniqueBusName()
            await first.requestName(name)
            assert.equal(await second.requestName(name, RequestNameFlags.DBUS_NAME_FLAG_REPLACE_EXISTING), RequestNameResultCode.DBUS_REQUEST_NAME_REPLY_IN_QUEUE)
            assert.equal(await observer.getNameOwner(name), first.uniqueName)
        })

        it('rejects an invalid bus name', async (): Promise<void> => {
            await assert.rejects(first.requestName('not a bus name'), {name: 'org.freedesktop.DBus.Error.InvalidArgs'})
        })
    })

    describe('ReleaseName', (): void => {
        it('reports a name nobody owns', async (): Promise<void> => {
            assert.equal(await first.releaseName(uniqueBusName()), RELEASE_NAME_REPLY_NON_EXISTENT)
        })

        it('reports a name owned by another connection', async (): Promise<void> => {
            const name: string = uniqueBusName()
            await first.requestName(name)
            assert.equal(await second.releaseName(name), RELEASE_NAME_REPLY_NOT_OWNER)
        })
    })

    describe('LocalService', (): void => {
        const services: TestService[] = []

        afterEach(async (): Promise<void> => {
            await Promise.all(services.splice(0).map((service: TestService): Promise<void> => withTimeout(service.service.stop(), 2000, 'stop').catch((): void => undefined)))
        })

        function service(name: string): TestService {
            const created: TestService = createTestService(name)
            services.push(created)
            return created
        }

        it('reports the RequestName result from run, honouring flags', async (): Promise<void> => {
            const name: string = uniqueBusName()
            assert.equal(await withTimeout(service(name).service.run({busAddress: bus.address}), 3000, 'run'), RequestNameResultCode.DBUS_REQUEST_NAME_REPLY_PRIMARY_OWNER)
            assert.equal(await withTimeout(service(name).service.run({busAddress: bus.address, flags: RequestNameFlags.DBUS_NAME_FLAG_DO_NOT_QUEUE}), 3000, 'run'), RequestNameResultCode.DBUS_REQUEST_NAME_REPLY_EXISTS)
        })

        it('releases its name on stop', async (): Promise<void> => {
            const name: string = uniqueBusName()
            const stopped: TestService = createTestService(name)
            await withTimeout(stopped.service.run({busAddress: bus.address}), 3000, 'run')
            const offline: Promise<any[]> = eventFor(observer, 'offline', name)
            await withTimeout(stopped.service.stop(), 3000, 'stop')
            await offline
            assert.equal(await observer.nameHasOwner(name), false)
        })

        it('receives signals again when a service that went offline comes back', async (): Promise<void> => {
            const name: string = uniqueBusName()
            const first: TestService = createTestService(name)
            await withTimeout(first.service.run({busAddress: bus.address}), 3000, 'run first')
            const remote: DBusService = await observer.getService(name)
            const iface: DBusInterface = await (await remote.getObject(TEST_OBJECT_PATH)).getInterface(TEST_INTERFACE)
            iface.signal.on('Tick', (): void => undefined)
            const offline: Promise<any[]> = eventFor(observer, 'offline', name)
            await withTimeout(first.service.stop(), 3000, 'stop first')
            await offline
            const online: Promise<any[]> = eventFor(observer, 'online', name)
            const second: TestService = service(name)
            await withTimeout(second.service.run({busAddress: bus.address}), 3000, 'run second')
            await online
            assert.equal(remote.uniqueName, second.service.dbus.uniqueName)
            const tick: Promise<any[]> = nextEvent(iface.signal, 'Tick')
            await observer.listNames()
            second.signals.emit('Tick', 12)
            assert.deepEqual(await tick, [12])
        })

        it('keeps a client DBusService and its signals working when a queued service takes over the name', async (): Promise<void> => {
            const name: string = uniqueBusName()
            const original: TestService = createTestService(name)
            const successor: TestService = service(name)
            await withTimeout(original.service.run({busAddress: bus.address}), 3000, 'run original')
            assert.equal(await withTimeout(successor.service.run({busAddress: bus.address}), 3000, 'run successor'), RequestNameResultCode.DBUS_REQUEST_NAME_REPLY_IN_QUEUE)
            const remote: DBusService = await observer.getService(name)
            const iface: DBusInterface = await (await remote.getObject(TEST_OBJECT_PATH)).getInterface(TEST_INTERFACE)
            iface.signal.on('Tick', (): void => undefined)
            const replaced: Promise<any[]> = eventFor(observer, 'replaced', name)
            await withTimeout(original.service.stop(), 3000, 'stop original')
            await replaced
            assert.equal(remote.uniqueName, successor.service.dbus.uniqueName)
            const tick: Promise<any[]> = nextEvent(iface.signal, 'Tick')
            await observer.listNames()
            successor.signals.emit('Tick', 11)
            assert.deepEqual(await tick, [11])
            assert.equal(await withTimeout(iface.method.Add(1, 2), 2000, 'Add'), 3)
        })
    })
})
