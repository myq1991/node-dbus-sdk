/**
 * Connect to the session bus and ask the bus itself a few questions.
 *
 * The bus daemon is a DBus service like any other: org.freedesktop.DBus at /org/freedesktop/DBus. This example calls it
 * three ways, from the most convenient to the most explicit.
 *
 * Run: node examples/01-bus-basics.ts   (in this repository: npm run example -- examples/01-bus-basics.ts)
 */
import {DBus, type DBusInterface} from 'dbus-sdk'

// No options: the session bus, from DBUS_SESSION_BUS_ADDRESS.
// For the system bus: DBus.connect({busAddress: 'unix:path=/run/dbus/system_bus_socket'})
const bus: DBus = await DBus.connect()
console.log('connected as', bus.uniqueName) // e.g. ':1.42', assigned by the bus

// 1. Helpers for the bus's own methods
const names: string[] = await bus.listNames()
console.log('names on the bus:', names.length, 'e.g.', names.filter((name: string): boolean => !name.startsWith(':')).slice(0, 5))
console.log('owner of org.freedesktop.DBus:', await bus.getNameOwner('org.freedesktop.DBus'))

// 2. A proxy built from introspection: methods are called with plain values, signatures come from the service
const daemon: DBusInterface = await bus.getInterface('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus')
const busId: string = await daemon.method.GetId() // a single return value is returned as is
console.log('bus id:', busId)
console.log('methods of org.freedesktop.DBus:', daemon.listMethods().map((method): string => method.name).join(', '))

// 3. A raw call with an explicit signature; the result is always the array of return values
const [hasOwner] = await bus.invoke({
    service: 'org.freedesktop.DBus',
    objectPath: '/org/freedesktop/DBus',
    interface: 'org.freedesktop.DBus',
    method: 'NameHasOwner',
    signature: 's',
    args: ['org.example.Nobody'],
    timeout: 5000 // milliseconds; without it a call waits until it is answered or the connection closes
})
console.log('org.example.Nobody has an owner:', hasOwner)

await bus.disconnect()
