import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBus} from '../../DBus'
import {DBusInterface} from '../../DBusInterface'
import {LocalService} from '../../LocalService'
import {LocalObject} from '../../LocalObject'
import {LocalInterface} from '../../LocalInterface'
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

    it('lists only objects below its own path', knownBug('GetManagedObjects also returns the object implementing the ObjectManager itself'), async (): Promise<void> => {
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
        const object: LocalObject = service.findObjectByPath(`${BASE_PATH}/first`)!
        const extra: LocalInterface = new LocalInterface(EXTRA_INTERFACE).defineProperty({name: 'Flag', type: 'b', getter: (): boolean => true})
        const [objectPath, interfaces] = await signalDuring('InterfacesAdded', (): boolean => object.addInterface(extra))
        assert.equal(objectPath, `${BASE_PATH}/first`)
        assert.deepEqual(interfaces, {[EXTRA_INTERFACE]: {Flag: true}})
    })

    it('emits InterfacesRemoved when an interface is removed', async (): Promise<void> => {
        const object: LocalObject = service.findObjectByPath(`${BASE_PATH}/first`)!
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
