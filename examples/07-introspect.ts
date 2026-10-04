/**
 * Explore a service: walk its object tree and print each interface's methods, properties and signals with their
 * signatures, like a small d-feet or busctl introspect.
 *
 * Run: node examples/07-introspect.ts [service name] [--system]
 *      e.g. node examples/07-introspect.ts org.freedesktop.DBus
 *      (in this repository: npm run example -- examples/07-introspect.ts org.freedesktop.DBus)
 */
import {DBus, type DBusObject, type DBusService, type IntrospectInterface} from 'dbus-sdk'

const args: string[] = process.argv.slice(2)
const serviceName: string = args.find((arg: string): boolean => !arg.startsWith('--')) ?? 'org.freedesktop.DBus'
const bus: DBus = await DBus.connect(args.includes('--system') ? {busAddress: 'unix:path=/run/dbus/system_bus_socket'} : {})

const service: DBusService = await bus.getService(serviceName)
const paths: string[] = await service.listObjectPaths() // walks the tree with Introspect
console.log(`${serviceName} (${service.uniqueName}): ${paths.length} object(s)`)

for (const path of paths) {
    const object: DBusObject = await service.getObject(path)
    const {interface: interfaces} = await object.introspect()
    if (!interfaces.length) continue
    console.log(`\n${path}`)
    for (const iface of interfaces as IntrospectInterface[]) {
        console.log(`  ${iface.name}`)
        for (const method of iface.method) {
            const inputs: string = method.arg.filter((arg): boolean => arg.direction === 'in').map((arg): string => `${arg.type} ${arg.name ?? ''}`.trim()).join(', ')
            const outputs: string = method.arg.filter((arg): boolean => arg.direction === 'out').map((arg): string => arg.type).join('')
            console.log(`    method   ${method.name}(${inputs})${outputs ? ` → ${outputs}` : ''}`)
        }
        for (const property of iface.property) console.log(`    property ${property.name}: ${property.type} (${property.access})`)
        for (const signal of iface.signal) console.log(`    signal   ${signal.name}(${signal.arg.map((arg): string => arg.type).join(', ')})`)
    }
}

await bus.disconnect()
