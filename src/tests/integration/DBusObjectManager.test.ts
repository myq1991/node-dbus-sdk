import {after, afterEach, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBus} from '../../DBus'
import {DBusInterface} from '../../DBusInterface'
import {DBusObjectManager} from '../../DBusObjectManager'
import {LocalService} from '../../LocalService'
import {LocalObject} from '../../LocalObject'
import {LocalInterface} from '../../LocalInterface'
import {PrivateBus} from '../helpers/PrivateBus'
import {nextEvent, withTimeout} from '../helpers/Async'

const DEVICE: string = 'org.example.Device1'

interface Device {
    object: LocalObject
    iface: LocalInterface
    state: { level: number, label: string }
}

function device(path: string, level: number): Device {
    const state = {level, label: 'new'}
    const iface: LocalInterface = new LocalInterface(DEVICE)
        .defineProperty({name: 'Level', type: 'u', getter: (): number => state.level})
        .defineProperty({name: 'Label', type: 's', emitPropertiesChanged: true, getter: (): string => state.label, setter: (value: string): void => {
            state.label = value
        }})
        .defineMethod({name: 'Double', outputArgs: [{type: 'u'}], method: (): number => state.level * 2})
    const object: LocalObject = new LocalObject(path)
    object.addInterface(iface)
    return {object, iface, state}
}

/**
 * Records a manager's events in order.
 */
function record(manager: DBusObjectManager): any[][] {
    const events: any[][] = []
    for (const event of ['objectAdded', 'objectRemoved', 'interfacesAdded', 'interfacesRemoved', 'propertiesChanged']) {
        manager.on(event, (...args: any[]): void => void events.push([event, ...args]))
    }
    return events
}

/**
 * DBusObjectManager following a LocalService through dbus-daemon.
 */
describe('DBusObjectManager', {skip: !PrivateBus.available && 'dbus-daemon not found', timeout: 30000}, (): void => {
    let bus: PrivateBus
    let client: DBus
    let counter: number = 0
    const cleanup: (() => Promise<unknown> | void)[] = []

    before(async (): Promise<void> => {
        bus = await PrivateBus.start()
        client = await withTimeout(DBus.connect({busAddress: bus.address}), 3000, 'connect')
    })

    afterEach(async (): Promise<void> => {
        for (const task of cleanup.splice(0)) await Promise.resolve(task()).catch((): void => undefined)
    })

    after(async (): Promise<void> => {
        await withTimeout(client.disconnect(), 2000, 'disconnect').catch((): void => undefined)
        await bus.stop()
    })

    async function serve(objects: LocalObject[], managerPath?: string): Promise<LocalService> {
        const service: LocalService = new LocalService(`org.example.Om${++counter}`, managerPath ? {objectManagerPath: managerPath} : {})
        objects.forEach((object: LocalObject): boolean => service.addObject(object))
        await withTimeout(service.run({busAddress: bus.address}), 3000, 'start service')
        cleanup.push((): Promise<void> => service.stop())
        return service
    }

    async function follow(service: string, path?: string): Promise<DBusObjectManager> {
        const manager: DBusObjectManager = await withTimeout(client.getObjectManager(service, path), 3000, 'getObjectManager')
        cleanup.push((): void => manager.close())
        return manager
    }

    /**
     * Waits until every signal the service sent so far has been handled.
     */
    async function settle(service: LocalService): Promise<void> {
        await new Promise((resolve): NodeJS.Immediate => setImmediate(resolve))
        await withTimeout(client.invoke({service: service.name, objectPath: '/', interface: 'org.freedesktop.DBus.Peer', method: 'Ping'}), 2000, 'ping')
    }

    it('loads the managed objects with their interfaces and properties', async (): Promise<void> => {
        const service: LocalService = await serve([device('/org/example/a', 1).object, device('/org/example/b', 2).object])
        const manager: DBusObjectManager = await follow(service.name)
        assert.deepEqual(manager.listObjectPaths().sort(), ['/org/example/a', '/org/example/b'])
        assert.ok(manager.listInterfaceNames('/org/example/a').includes(DEVICE))
        assert.deepEqual(manager.getProperties('/org/example/b', DEVICE), {Level: 2, Label: 'new'})
        assert.equal(manager.getProperties('/org/example/missing', DEVICE), undefined)
        assert.deepEqual(manager.listInterfaceNames('/org/example/missing'), [])
        const [fromService] = await client.invoke({service: service.name, objectPath: '/', interface: 'org.freedesktop.DBus.ObjectManager', method: 'GetManagedObjects'})
        assert.deepEqual(manager.getManagedObjects(), fromService)
    })

    it('follows objects and interfaces being added and removed', async (): Promise<void> => {
        const first: Device = device('/org/example/first', 1)
        const service: LocalService = await serve([first.object])
        const manager: DBusObjectManager = await follow(service.name)
        const events: any[][] = record(manager)
        const second: Device = device('/org/example/second', 2)
        service.addObject(second.object)
        first.object.addInterface(new LocalInterface('org.example.Extra1').defineProperty({name: 'Flag', type: 'b', getter: (): boolean => true}))
        first.object.removeInterface('org.example.Extra1')
        service.removeObject(second.object)
        await settle(service)
        assert.deepEqual(events.map((event: any[]): any[] => event.slice(0, 2)), [
            ['objectAdded', '/org/example/second'],
            ['interfacesAdded', '/org/example/first'],
            ['interfacesRemoved', '/org/example/first'],
            ['objectRemoved', '/org/example/second']
        ])
        assert.deepEqual(events[0][2][DEVICE], {Level: 2, Label: 'new'})
        assert.deepEqual(events[1][2], {'org.example.Extra1': {Flag: true}})
        assert.deepEqual(events[2][2], ['org.example.Extra1'])
        assert.ok(events[3][2].includes(DEVICE))
        assert.deepEqual(manager.listObjectPaths(), ['/org/example/first'])
        assert.ok(!manager.listInterfaceNames('/org/example/first').includes('org.example.Extra1'))
    })

    it('keeps properties up to date from PropertiesChanged', async (): Promise<void> => {
        const target: Device = device('/org/example/target', 1)
        const service: LocalService = await serve([target.object])
        const manager: DBusObjectManager = await follow(service.name)
        const changed: Promise<any[]> = nextEvent(manager, 'propertiesChanged')
        target.state.level = 7
        target.iface.emitPropertiesChanged('Level')
        assert.deepEqual(await changed, ['/org/example/target', DEVICE, {Level: 7}, []])
        assert.deepEqual(manager.getProperties('/org/example/target', DEVICE), {Level: 7, Label: 'new'})
        // A change made by a client through Set reaches the copy too
        const proxy: DBusInterface = await manager.getInterface('/org/example/target', DEVICE)
        await proxy.property.Label.set('renamed')
        await settle(service)
        assert.equal(manager.getProperties('/org/example/target', DEVICE)!.Label, 'renamed')
        assert.equal(await proxy.method.Double(), 14)
    })

    it('removes invalidated properties from the copy', async (): Promise<void> => {
        const state = {secret: 'a'}
        const object: LocalObject = new LocalObject('/org/example/secret')
        const iface: LocalInterface = new LocalInterface('org.example.Secret1').defineProperty({name: 'Value', type: 's', emitPropertiesChanged: {emitValue: false}, getter: (): string => state.secret})
        object.addInterface(iface)
        const service: LocalService = await serve([object])
        const manager: DBusObjectManager = await follow(service.name)
        assert.deepEqual(manager.getProperties('/org/example/secret', 'org.example.Secret1'), {Value: 'a'})
        const changed: Promise<any[]> = nextEvent(manager, 'propertiesChanged')
        iface.emitPropertiesChanged('Value')
        assert.deepEqual(await changed, ['/org/example/secret', 'org.example.Secret1', {}, ['Value']])
        assert.deepEqual(manager.getProperties('/org/example/secret', 'org.example.Secret1'), {})
    })

    it('ignores PropertiesChanged of objects it does not manage', async (): Promise<void> => {
        const service: LocalService = await serve([], '/org/example/App')
        const outside: Device = device('/org/other', 1)
        service.addObject(outside.object)
        const manager: DBusObjectManager = await follow(service.name, '/org/example/App')
        const events: any[][] = record(manager)
        outside.iface.emitPropertiesChanged('Level')
        await settle(service)
        assert.deepEqual(events, [])
    })

    it('follows a manager at another path', async (): Promise<void> => {
        const service: LocalService = await serve([device('/org/example/App/inside', 1).object, device('/org/example/outside', 2).object], '/org/example/App')
        const manager: DBusObjectManager = await follow(service.name, '/org/example/App')
        assert.deepEqual(manager.listObjectPaths(), ['/org/example/App/inside'])
    })

    it('rejects when the path has no object manager', async (): Promise<void> => {
        const service: LocalService = await serve([], '/org/example/App')
        await assert.rejects(client.getObjectManager(service.name, '/'))
    })

    it('removes the objects when the service leaves, and reads them again when it comes back', async (): Promise<void> => {
        const name: string = `org.example.Om${++counter}`
        const first: LocalService = new LocalService(name)
        first.addObject(device('/org/example/a', 1).object)
        first.addObject(device('/org/example/b', 2).object)
        await first.run({busAddress: bus.address})
        const manager: DBusObjectManager = await follow(name)
        const events: any[][] = record(manager)
        const removed: Promise<unknown> = new Promise((resolve): void => {
            manager.on('objectRemoved', (): void => void (manager.listObjectPaths().length || resolve(undefined)))
        })
        await first.stop()
        await withTimeout(removed, 3000, 'objects removed')
        assert.deepEqual(events.map((event: any[]): any[] => event.slice(0, 2)).sort(), [['objectRemoved', '/org/example/a'], ['objectRemoved', '/org/example/b']])
        events.length = 0
        const added: Promise<any[]> = nextEvent(manager, 'objectAdded')
        const second: LocalService = new LocalService(name)
        second.addObject(device('/org/example/c', 3).object)
        await second.run({busAddress: bus.address})
        cleanup.push((): Promise<void> => second.stop())
        assert.equal((await added)[0], '/org/example/c')
        assert.deepEqual(manager.listObjectPaths(), ['/org/example/c'])
        // Changes after the reload are followed as before
        const changedNext: Promise<any[]> = nextEvent(manager, 'objectAdded')
        second.addObject(device('/org/example/d', 4).object)
        assert.equal((await changedNext)[0], '/org/example/d')
    })

    it('stays consistent with the service while objects change during loading', async (): Promise<void> => {
        const service: LocalService = await serve([])
        let index: number = 0
        const churn: NodeJS.Timeout = setInterval((): void => {
            const path: string = `/org/example/churn${index++ % 20}`
            if (service.getObject(path)) {
                service.removeObject(path)
            } else {
                service.addObject(device(path, index).object)
            }
        }, 1)
        // Stop changing right after loading, so that a change missed around the load is not repaired by a later one
        const managers: DBusObjectManager[] = await Promise.all([1, 2, 3, 4, 5].map((): Promise<DBusObjectManager> => follow(service.name)))
        clearInterval(churn)
        await settle(service)
        const [expected] = await client.invoke({service: service.name, objectPath: '/', interface: 'org.freedesktop.DBus.ObjectManager', method: 'GetManagedObjects'})
        for (const manager of managers) assert.deepEqual(manager.getManagedObjects(), expected)
    })

    it('stops following after close', async (): Promise<void> => {
        const service: LocalService = await serve([])
        const manager: DBusObjectManager = await follow(service.name)
        const events: any[][] = record(manager)
        manager.close()
        service.addObject(device('/org/example/late', 1).object)
        await settle(service)
        assert.deepEqual(events, [])
        assert.deepEqual(manager.listObjectPaths(), [])
    })
})
