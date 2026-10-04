/**
 * org.freedesktop.DBus.ObjectManager: a service whose objects come and go, and a client that keeps a copy of them.
 *
 * Service side: every LocalService has an object manager ('/' by default; new LocalService(name, {objectManagerPath}) puts
 * it elsewhere). Adding and removing objects or interfaces sends InterfacesAdded / InterfacesRemoved, and
 * emitPropertiesChanged announces properties the service changes itself.
 *
 * Client side: DBus.getObjectManager loads the managed objects and keeps them up to date, with events for changes.
 *
 * Run: node examples/06-object-manager.ts   (in this repository: npm run example -- examples/06-object-manager.ts)
 */
import {DBus, type DBusInterface, type DBusObjectManager, LocalInterface, LocalObject, LocalService} from 'dbus-sdk'

// --- Service: one object per disk, with a read-only Temperature the service updates itself
const service: LocalService = new LocalService('org.example.Disks', {objectManagerPath: '/org/example/Disks'})
await service.run()

const temperatures: Map<string, number> = new Map()

function addDisk(id: string, model: string): LocalObject {
    temperatures.set(id, 30)
    const disk: LocalInterface = new LocalInterface('org.example.Disk1')
        .defineProperty({name: 'Model', type: 's', getter: (): string => model})
        .defineProperty({name: 'Temperature', type: 'u', getter: (): number => temperatures.get(id)!})
        .defineMethod({name: 'Eject', method: (): void => void service.removeObject(`/org/example/Disks/${id}`)})
    const object: LocalObject = new LocalObject(`/org/example/Disks/${id}`)
    object.addInterface(disk)
    service.addObject(object) // sends InterfacesAdded from the object manager
    return object
}

addDisk('sda', 'Disk A')

// --- Client
const bus: DBus = await DBus.connect()
const manager: DBusObjectManager = await bus.getObjectManager('org.example.Disks', '/org/example/Disks')

for (const path of manager.listObjectPaths()) {
    console.log('managed', path, manager.getProperties(path, 'org.example.Disk1'))
}

manager.on('objectAdded', (path: string, interfaces: Record<string, Record<string, unknown>>): void => {
    console.log('added', path, interfaces['org.example.Disk1'])
})
manager.on('propertiesChanged', (path: string, iface: string, changed: Record<string, unknown>): void => {
    console.log('changed', path, changed, '→ copy:', manager.getProperties(path, iface))
})
const removed: Promise<void> = new Promise((resolve): void => {
    manager.on('objectRemoved', (path: string): void => {
        console.log('removed', path, '→ objects:', manager.listObjectPaths())
        resolve()
    })
})

// The service changes: a disk appears, its temperature rises, and a client ejects it through a method call
const sdb: LocalObject = addDisk('sdb', 'Disk B')
temperatures.set('sdb', 45)
sdb.getInterface('org.example.Disk1')!.emitPropertiesChanged('Temperature')

// Proxies for managed objects come from the manager too
const disk: DBusInterface = await manager.getInterface('/org/example/Disks/sdb', 'org.example.Disk1')
await disk.method.Eject()
await removed

manager.close()
await bus.disconnect()
await service.stop()
