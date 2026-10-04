/**
 * org.freedesktop.DBus.ObjectManager: a service whose objects come and go, and a client that lists them and follows
 * the changes.
 *
 * Every LocalService has an object manager at '/'. Adding or removing objects (and interfaces) sends InterfacesAdded
 * and InterfacesRemoved, and GetManagedObjects returns all objects below '/' with their properties.
 *
 * Run: node examples/06-object-manager.ts   (in this repository: npm run example -- examples/06-object-manager.ts)
 */
import {DBus, type DBusInterface, LocalInterface, LocalObject, LocalService} from 'dbus-sdk'

// --- Service: one object per device
const service: LocalService = new LocalService('org.example.Devices')
await service.run()

function addDevice(id: string, model: string): LocalObject {
    const device: LocalInterface = new LocalInterface('org.example.Device1')
        .defineProperty({name: 'Id', type: 's', getter: (): string => id})
        .defineProperty({name: 'Model', type: 's', getter: (): string => model})
    const object: LocalObject = new LocalObject(`/org/example/devices/${id}`)
    object.addInterface(device)
    service.addObject(object) // sends InterfacesAdded
    return object
}

addDevice('sda', 'Disk A')

// --- Client
const bus: DBus = await DBus.connect()
const manager: DBusInterface = await bus.getInterface('org.example.Devices', '/', 'org.freedesktop.DBus.ObjectManager')

const changes: Promise<void> = new Promise((resolve): void => {
    // InterfacesAdded(object path, {interface: {property: value}})
    manager.signal.on('InterfacesAdded', (path: string, interfaces: Record<string, Record<string, unknown>>): void => {
        console.log('added', path, interfaces['org.example.Device1'])
    })
    // InterfacesRemoved(object path, interface names)
    manager.signal.on('InterfacesRemoved', (path: string, interfaces: string[]): void => {
        console.log('removed', path, interfaces.filter((name: string): boolean => !name.startsWith('org.freedesktop.')))
        resolve()
    })
})

// {object path: {interface: {property: value}}}, for every object below '/'
const objects: Record<string, Record<string, Record<string, unknown>>> = await manager.method.GetManagedObjects()
for (const [path, interfaces] of Object.entries(objects)) console.log('managed', path, interfaces['org.example.Device1'])

// Listening sends a match rule to the bus without waiting for an answer. The call above was answered after the bus had
// processed it, so the changes below are sure to be forwarded.
const sdb: LocalObject = addDevice('sdb', 'Disk B')
service.removeObject(sdb) // sends InterfacesRemoved
await changes

await bus.disconnect()
await service.stop()
