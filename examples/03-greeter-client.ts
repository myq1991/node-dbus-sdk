/**
 * A client for 02-greeter-service.ts: calls methods, reads and writes properties, receives signals and handles errors.
 *
 * Start the service first, then run: node examples/03-greeter-client.ts
 * (in this repository: npm run example -- examples/03-greeter-client.ts)
 */
import {DBus, type DBusInterface, TimeoutError} from 'dbus-sdk'

const bus: DBus = await DBus.connect()

// Introspects /org/example/Greeter and builds a proxy for the interface
const greeter: DBusInterface = await bus.getInterface('org.example.Greeter', '/org/example/Greeter', 'org.example.Greeter1')
const properties: DBusInterface = await bus.getInterface('org.example.Greeter', '/org/example/Greeter', 'org.freedesktop.DBus.Properties')

// Signals: listen on the interface's signal emitter. The listener receives the signal's arguments.
const greetedSignal: Promise<void> = new Promise((resolve): void => {
    greeter.signal.once('Greeted', (name: string, count: number): void => {
        console.log(`signal Greeted: ${name} (#${count})`)
        resolve()
    })
})
const propertiesChanged: Promise<void> = new Promise((resolve): void => {
    // PropertiesChanged(interface, changed properties as {name: value}, names of invalidated properties)
    properties.signal.once('PropertiesChanged', (iface: string, changed: Record<string, unknown>, invalidated: string[]): void => {
        console.log('signal PropertiesChanged:', iface, changed, invalidated)
        resolve()
    })
})

// Methods with positional arguments. One return value is returned as is...
console.log(await greeter.method.Greet('Alice'))
// ...or with named arguments, matched to the introspected argument names
console.log(await greeter.namedMethod.Greet({name: 'Bob'}))
// ...several return values come as an array
const [count, since] = await greeter.method.Stats()
console.log(`greeted ${count} times since ${since}`)
// ...and no return value gives undefined
console.log('Slow(10) returned', await greeter.method.Slow(10))
console.log('the service sees me as', await greeter.method.WhoAmI(), '- my unique name is', bus.uniqueName)

// Errors from the service reject with an Error whose name is the DBus error name
try {
    await greeter.method.Divide(1, 0)
} catch (error) {
    const {name, message} = error as Error
    console.log(`Divide failed: ${name}: ${message}`) // org.example.Greeter1.Error.DivisionByZero: Cannot divide by zero
}

// Timeouts: the per-call timeout is available on DBus.invoke; DBus.connect({callTimeout}) or bus.callTimeout set a
// default for every call, including the proxy's
bus.callTimeout = 100
try {
    await greeter.method.Slow(1000)
} catch (error) {
    console.log('Slow(1000):', error instanceof TimeoutError ? 'timed out' : error)
}
bus.callTimeout = undefined

// Properties
console.log('Greeting is', await greeter.property.Greeting.get())
await greeter.property.Greeting.set('Howdy')
console.log(await greeter.method.Greet('Carol'))
try {
    await greeter.property.Greeting.set('   ')
} catch (error) {
    console.log('rejected:', (error as Error).message)
}

await Promise.all([greetedSignal, propertiesChanged])
await bus.disconnect()
