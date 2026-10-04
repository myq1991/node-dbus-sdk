import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBus} from '../../DBus'
import {DBusInterface} from '../../DBusInterface'
import {LocalService} from '../../LocalService'
import {LocalObject} from '../../LocalObject'
import {LocalInterface} from '../../LocalInterface'
import {ObjectManagerInterface} from '../../lib/common/ObjectManagerInterface'
import EventEmitter from 'node:events'
import {PrivateBus} from '../helpers/PrivateBus'
import {nextEvent, withTimeout} from '../helpers/Async'
import {knownBug} from '../helpers/KnownBug'

const SERVICE_NAME: string = 'org.example.Managed'
const BASE_PATH: string = '/org/example/Managed'
const ITEM_INTERFACE: string = 'org.example.Item'
const EXTRA_INTERFACE: string = 'org.example.Extra'

function itemInterface(value: number): LocalInterface {
    return new LocalInterface(ITEM_INTERFACE).defineProperty({name: 'Value', type: 'u', getter: (): number => value})
}

function item(name: string, value: number): LocalObject {
    const object: LocalObject = new LocalObject(`${BASE_PATH}/${name}`)
    object.addInterface(itemInterface(value))
    return object
}

/**
 * org.freedesktop.DBus.ObjectManager on the root object of a LocalService, observed by a client through dbus-daemon.
 */
describe('ObjectManager', {skip: !PrivateBus.available && 'dbus-daemon not found', timeout: 30000}, (): void => {
    let bus: PrivateBus
    let service: LocalService
    let client: DBus
    let manager: DBusInterface

    before(async (): Promise<void> => {
        bus = await PrivateBus.start()
        service = new LocalService(SERVICE_NAME)
        service.addObject(item('first', 1))
        await withTimeout(service.run({busAddress: bus.address}), 3000, 'start service')
        client = await withTimeout(DBus.connect({busAddress: bus.address}), 3000, 'connect')
        manager = await withTimeout(client.getInterface(SERVICE_NAME, '/', 'org.freedesktop.DBus.ObjectManager'), 2000, 'get ObjectManager')
    })

    after(async (): Promise<void> => {
        await withTimeout(service.stop(), 2000, 'stop service').catch((): void => undefined)
        await withTimeout(client.disconnect(), 2000, 'disconnect').catch((): void => undefined)
        await bus.stop()
    })

    async function managedObjects(): Promise<Record<string, Record<string, Record<string, any>>>> {
        return withTimeout(manager.method.GetManagedObjects(), 2000, 'GetManagedObjects')
    }

    /**
     * Waits for the next signal of the ObjectManager after making sure the match rule is active.
     */
    async function signalDuring(signal: string, action: () => void): Promise<any[]> {
        const received: Promise<any[]> = nextEvent(manager.signal, signal)
        await withTimeout(client.listNames(), 2000, 'sync')
        action()
        return received
    }

    it('lists objects with their interfaces and property values', async (): Promise<void> => {
        const objects: Record<string, Record<string, Record<string, any>>> = await managedObjects()
        assert.deepEqual(objects[`${BASE_PATH}/first`][ITEM_INTERFACE], {Value: 1})
    })

    it('lists only objects below its own path', async (): Promise<void> => {
        const objects: Record<string, Record<string, Record<string, any>>> = await managedObjects()
        assert.ok(!('/' in objects), `unexpected entry for '/' with ${Object.keys(objects['/'] || {}).join(', ')}`)
    })

    it('emits InterfacesAdded when an object is added', async (): Promise<void> => {
        const [objectPath, interfaces] = await signalDuring('InterfacesAdded', (): boolean => service.addObject(item('second', 2)))
        assert.equal(objectPath, `${BASE_PATH}/second`)
        assert.deepEqual(interfaces[ITEM_INTERFACE], {Value: 2})
        assert.deepEqual((await managedObjects())[`${BASE_PATH}/second`][ITEM_INTERFACE], {Value: 2})
    })

    it('emits InterfacesAdded when an interface is added to an exported object', async (): Promise<void> => {
        const object: LocalObject = service.getObject(`${BASE_PATH}/first`)!
        const extra: LocalInterface = new LocalInterface(EXTRA_INTERFACE).defineProperty({name: 'Flag', type: 'b', getter: (): boolean => true})
        const [objectPath, interfaces] = await signalDuring('InterfacesAdded', (): boolean => object.addInterface(extra))
        assert.equal(objectPath, `${BASE_PATH}/first`)
        assert.deepEqual(interfaces, {[EXTRA_INTERFACE]: {Flag: true}})
    })

    it('emits InterfacesRemoved when an interface is removed', async (): Promise<void> => {
        const object: LocalObject = service.getObject(`${BASE_PATH}/first`)!
        const [objectPath, interfaces] = await signalDuring('InterfacesRemoved', (): boolean => object.removeInterface(EXTRA_INTERFACE))
        assert.equal(objectPath, `${BASE_PATH}/first`)
        assert.deepEqual(interfaces, [EXTRA_INTERFACE])
        assert.ok(!(EXTRA_INTERFACE in (await managedObjects())[`${BASE_PATH}/first`]))
    })

    it('emits InterfacesRemoved with all interfaces when an object is removed', async (): Promise<void> => {
        const [objectPath, interfaces] = await signalDuring('InterfacesRemoved', (): boolean => service.removeObject(`${BASE_PATH}/second`))
        assert.equal(objectPath, `${BASE_PATH}/second`)
        assert.ok(interfaces.includes(ITEM_INTERFACE), `removed interfaces: ${interfaces.join(', ')}`)
        assert.ok(!(`${BASE_PATH}/second` in await managedObjects()))
    })
})

/**
 * Object managers elsewhere than '/', nested managers, properties that cannot be read, and announcing property
 * changes, each with its own service.
 */
describe('ObjectManager rules', {skip: !PrivateBus.available && 'dbus-daemon not found', timeout: 30000}, (): void => {
    let bus: PrivateBus
    let client: DBus
    let counter: number = 0
    const running: LocalService[] = []

    before(async (): Promise<void> => {
        bus = await PrivateBus.start()
        client = await withTimeout(DBus.connect({busAddress: bus.address}), 3000, 'connect')
    })

    after(async (): Promise<void> => {
        for (const service of running) await withTimeout(service.stop(), 2000, 'stop service').catch((): void => undefined)
        await withTimeout(client.disconnect(), 2000, 'disconnect').catch((): void => undefined)
        await bus.stop()
    })

    async function start(service: LocalService): Promise<LocalService> {
        await withTimeout(service.run({busAddress: bus.address}), 3000, 'start service')
        running.push(service)
        return service
    }

    function name(): string {
        return `org.example.Rules${++counter}`
    }

    async function managedObjects(service: string, path: string): Promise<Record<string, Record<string, Record<string, any>>>> {
        const [objects] = await withTimeout(client.invoke({service, objectPath: path, interface: 'org.freedesktop.DBus.ObjectManager', method: 'GetManagedObjects'}), 2000, 'GetManagedObjects')
        return objects
    }

    /**
     * Collects the signals of an interface from a service while the action runs; a round trip before and after
     * makes sure the match rule is active and every signal sent by the action has arrived.
     */
    async function signalsDuring(service: string, path: string, iface: string, action: () => unknown): Promise<{ name: string, objectPath: string, args: any[] }[]> {
        const owner: string | undefined = await client.getNameOwner(service)
        const emitter = client.createSignalEmitter({service, uniqueName: owner!, objectPath: path, interface: iface})
        const received: { name: string, objectPath: string, args: any[] }[] = []
        const listener = (signal: { name: string, objectPath: string, args: any[] }): void => void received.push(signal)
        emitter.onAny(listener)
        await withTimeout(client.listNames(), 2000, 'sync')
        await action()
        await new Promise((resolve): NodeJS.Immediate => setImmediate(resolve))
        await withTimeout(client.invoke({service, objectPath: '/', interface: 'org.freedesktop.DBus.Peer', method: 'Ping'}), 2000, 'sync with service')
        emitter.offAny(listener)
        return received
    }

    describe('properties that cannot be read', (): void => {
        const broken = (): LocalInterface => new LocalInterface('org.example.Sensor1')
            .defineProperty({name: 'Name', type: 's', getter: (): string => 'probe'})
            .defineProperty({name: 'Reading', type: 'd', getter: (): number => {
                throw new Error('sensor offline')
            }})

        it('do not stop objects from being added, before or while the service runs', async (): Promise<void> => {
            const service: LocalService = new LocalService(name())
            const before: LocalObject = new LocalObject('/org/example/before')
            assert.doesNotThrow((): boolean => before.addInterface(broken()))
            assert.doesNotThrow((): boolean => service.addObject(before))
            await start(service)
            const during: LocalObject = new LocalObject('/org/example/during')
            during.addInterface(broken())
            const signals = await signalsDuring(service.name, '/', 'org.freedesktop.DBus.ObjectManager', (): boolean => service.addObject(during))
            assert.deepEqual(signals.map((signal): any[] => [signal.args[0], signal.args[1]['org.example.Sensor1']]), [['/org/example/during', {Name: 'probe'}]])
        })

        it('are left out of GetManagedObjects and GetAll, and Get reports the error', async (): Promise<void> => {
            const service: LocalService = new LocalService(name())
            const object: LocalObject = new LocalObject('/org/example/sensor')
            object.addInterface(broken())
            service.addObject(object)
            await start(service)
            assert.deepEqual((await managedObjects(service.name, '/'))['/org/example/sensor']['org.example.Sensor1'], {Name: 'probe'})
            const [all] = await client.invoke({service: service.name, objectPath: '/org/example/sensor', interface: 'org.freedesktop.DBus.Properties', method: 'GetAll', signature: 's', args: ['org.example.Sensor1']})
            assert.deepEqual(all, {Name: 'probe'})
            await assert.rejects(client.getProperty({service: service.name, objectPath: '/org/example/sensor', interface: 'org.example.Sensor1', property: 'Reading'}), {message: 'sensor offline'})
        })
    })

    it('does not report the manager\'s own object', async (): Promise<void> => {
        const service: LocalService = await start(new LocalService(name()))
        const signals = await signalsDuring(service.name, '/', 'org.freedesktop.DBus.ObjectManager', (): void => {
            service.getObject('/')!.addInterface(new LocalInterface('org.example.Root1'))
            service.getObject('/')!.removeInterface('org.example.Root1')
        })
        assert.deepEqual(signals, [])
        assert.ok(!('/' in await managedObjects(service.name, '/')))
    })

    describe('objectManagerPath', (): void => {
        it('puts the manager on another object, which reports only the objects below it', async (): Promise<void> => {
            const service: LocalService = new LocalService(name(), {objectManagerPath: '/org/example/App'})
            service.addObject(item('inside', 1))
            const outside: LocalObject = new LocalObject('/org/other')
            outside.addInterface(itemInterface(2))
            service.addObject(outside)
            const appPath: string = '/org/example/App'
            const inside: LocalObject = new LocalObject(`${appPath}/inside`)
            inside.addInterface(itemInterface(3))
            service.addObject(inside)
            await start(service)
            assert.equal(service.objectManager, service.getObject(appPath)!.getInterface('org.freedesktop.DBus.ObjectManager'))
            assert.deepEqual(Object.keys(await managedObjects(service.name, appPath)), [`${appPath}/inside`])
            await assert.rejects(managedObjects(service.name, '/'))
            const later: LocalObject = new LocalObject(`${appPath}/later`)
            later.addInterface(itemInterface(4))
            const signals = await signalsDuring(service.name, '*', 'org.freedesktop.DBus.ObjectManager', (): boolean => service.addObject(later))
            assert.deepEqual(signals.map((signal): string[] => [signal.objectPath, signal.name, signal.args[0]]), [[appPath, 'InterfacesAdded', `${appPath}/later`]])
        })

        it('null leaves the service without an object manager', async (): Promise<void> => {
            const service: LocalService = await start(new LocalService(name(), {objectManagerPath: null}))
            assert.equal(service.objectManager, undefined)
            assert.ok(!service.getObject('/')!.listInterfaceNames().includes('org.freedesktop.DBus.ObjectManager'))
            await assert.rejects(managedObjects(service.name, '/'))
        })
    })

    it('lets a nested manager report the objects below it instead of the outer one', async (): Promise<void> => {
        const service: LocalService = new LocalService(name())
        const sub: LocalObject = new LocalObject('/org/example/Sub')
        sub.addInterface(new ObjectManagerInterface())
        service.addObject(sub)
        const deep: LocalObject = new LocalObject('/org/example/Sub/deep')
        deep.addInterface(itemInterface(1))
        service.addObject(deep)
        await start(service)
        const outer = await managedObjects(service.name, '/')
        assert.ok('/org/example/Sub' in outer && !('/org/example/Sub/deep' in outer), Object.keys(outer).join(', '))
        assert.deepEqual(Object.keys(await managedObjects(service.name, '/org/example/Sub')), ['/org/example/Sub/deep'])
        const later: LocalObject = new LocalObject('/org/example/Sub/later')
        later.addInterface(itemInterface(2))
        const signals = await signalsDuring(service.name, '*', 'org.freedesktop.DBus.ObjectManager', (): boolean => service.addObject(later))
        assert.deepEqual(signals.map((signal): string => signal.objectPath), ['/org/example/Sub'])
    })

    describe('LocalInterface.emitPropertiesChanged', (): void => {
        let level: number = 1
        let iface: LocalInterface
        let service: LocalService

        before(async (): Promise<void> => {
            iface = new LocalInterface('org.example.Battery1')
                .defineProperty({name: 'Level', type: 'u', getter: (): number => level})
                .defineProperty({name: 'State', type: 's', getter: (): string => 'charging'})
                .defineProperty({name: 'Secret', type: 's', emitPropertiesChanged: {emitValue: false}, getter: (): string => 'hidden'})
                .defineProperty({name: 'Broken', type: 'u', getter: (): number => {
                    throw new Error('unavailable')
                }})
            const object: LocalObject = new LocalObject('/org/example/battery')
            object.addInterface(iface)
            service = new LocalService(name())
            service.addObject(object)
            await start(service)
        })

        const propertiesChanged = (action: () => void): Promise<any[][]> => signalsDuring(service.name, '/org/example/battery', 'org.freedesktop.DBus.Properties', action)
            .then((signals): any[][] => signals.map((signal): any[] => signal.args))

        it('sends the current value of a read-only property', async (): Promise<void> => {
            assert.deepEqual(await propertiesChanged((): void => {
                level = 42
                iface.emitPropertiesChanged('Level')
            }), [['org.example.Battery1', {Level: 42}, []]])
        })

        it('sends changes announced together in one signal', async (): Promise<void> => {
            assert.deepEqual(await propertiesChanged((): void => {
                iface.emitPropertiesChanged('Level')
                iface.emitPropertiesChanged(['State'])
            }), [['org.example.Battery1', {Level: 42, State: 'charging'}, []]])
        })

        it('invalidates properties that do not send values or cannot be read', async (): Promise<void> => {
            assert.deepEqual(await propertiesChanged((): void => iface.emitPropertiesChanged(['Secret', 'Broken'])), [['org.example.Battery1', {}, ['Secret', 'Broken']]])
        })

        it('rejects an unknown property and sends nothing', async (): Promise<void> => {
            assert.deepEqual(await propertiesChanged((): void => {
                assert.throws((): void => iface.emitPropertiesChanged(['Level', 'Missing']), {name: 'org.freedesktop.DBus.Error.UnknownProperty'})
            }), [])
        })

        it('does nothing while the service is not running', async (): Promise<void> => {
            const idle: LocalInterface = new LocalInterface('org.example.Idle1').defineProperty({name: 'Value', type: 'u', getter: (): number => 1})
            assert.doesNotThrow((): void => idle.emitPropertiesChanged('Value'))
            const object: LocalObject = new LocalObject('/org/example/idle')
            object.addInterface(idle)
            const stopped: LocalService = new LocalService(name())
            stopped.addObject(object)
            await stopped.run({busAddress: bus.address})
            await stopped.stop()
            assert.doesNotThrow((): void => idle.emitPropertiesChanged('Value'))
            await new Promise((resolve): NodeJS.Immediate => setImmediate(resolve))
        })
    })

    it('does not throw when a signal is emitted after the service stopped', async (): Promise<void> => {
        const events: EventEmitter = new EventEmitter()
        const object: LocalObject = new LocalObject('/org/example/emitter')
        object.addInterface(new LocalInterface('org.example.Events1').defineSignal({name: 'Happened', args: [{type: 's'}], eventEmitter: events}))
        const service: LocalService = new LocalService(name())
        service.addObject(object)
        await service.run({busAddress: bus.address})
        await service.stop()
        assert.doesNotThrow((): boolean => events.emit('Happened', 'late'))
        assert.doesNotThrow((): boolean => service.addObject(item('late', 1)))
    })
})
