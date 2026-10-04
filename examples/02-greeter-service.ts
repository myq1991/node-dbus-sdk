/**
 * A DBus service: org.example.Greeter, with one object and one interface showing methods, properties, signals and
 * errors. 03-greeter-client.ts calls it.
 *
 * The service runs until it receives SIGINT or SIGTERM, then stops gracefully: calls being handled are answered
 * before the name is released.
 *
 * Run: node examples/02-greeter-service.ts   (in this repository: npm run example -- examples/02-greeter-service.ts)
 */
import EventEmitter from 'node:events'
import {createDBusError, LocalInterface, LocalObject, LocalService, type MethodCallContext, RequestNameResultCode} from 'dbus-sdk'

let greeting: string = 'Hello'
let greeted: number = 0

// A signal is defined with an EventEmitter: emitting the event sends the signal
const events: EventEmitter = new EventEmitter()

const greeter: LocalInterface = new LocalInterface('org.example.Greeter1')
    .defineMethod({
        name: 'Greet',
        inputArgs: [{name: 'name', type: 's'}],
        outputArgs: [{name: 'message', type: 's'}],
        method: (name: string): string => {
            greeted++
            events.emit('Greeted', name, greeted) // the arguments of the signal, in order
            return `${greeting}, ${name}!`
        }
    })
    .defineMethod({
        name: 'Divide',
        inputArgs: [{name: 'dividend', type: 'd'}, {name: 'divisor', type: 'd'}],
        outputArgs: [{name: 'quotient', type: 'd'}],
        method: (dividend: number, divisor: number): number => {
            // A thrown error is sent to the caller as a DBus error. createDBusError chooses its DBus name; any other
            // error is named after the service, e.g. org.example.Greeter.Error
            if (divisor === 0) throw createDBusError('org.example.Greeter1.Error.DivisionByZero', 'Cannot divide by zero')
            return dividend / divisor
        }
    })
    .defineMethod({
        name: 'Stats',
        outputArgs: [{name: 'count', type: 'u'}, {name: 'since', type: 's'}],
        // Several output arguments: return them as an array, in order
        method: (): [number, string] => [greeted, startedAt]
    })
    .defineMethod({
        name: 'WhoAmI',
        outputArgs: [{name: 'sender', type: 's'}],
        // withContext adds the call's context after the input arguments, e.g. to check who is calling
        withContext: true,
        method: (context: MethodCallContext): string => context.sender
    })
    .defineMethod({
        name: 'Slow',
        inputArgs: [{name: 'milliseconds', type: 'u'}],
        // Handlers may be async; the reply is sent when the promise settles
        method: async (milliseconds: number): Promise<void> => new Promise((resolve): void => {
            setTimeout(resolve, milliseconds)
        })
    })
    .defineMethod({
        name: 'Hello',
        outputArgs: [{type: 's'}],
        method: (): string => 'hello',
        // Annotations are published in the introspection data
        annotations: {'org.freedesktop.DBus.Deprecated': 'true'}
    })
    .defineProperty({
        name: 'Greeting',
        type: 's',
        // Changes made through Set are announced with org.freedesktop.DBus.Properties.PropertiesChanged
        emitPropertiesChanged: true,
        getter: (): string => greeting,
        setter: (value: string): void => {
            // A setter may be async and may throw; the caller of Set gets the error
            if (!value.trim()) throw createDBusError('org.freedesktop.DBus.Error.InvalidArgs', 'The greeting cannot be empty')
            greeting = value
        }
    })
    .defineProperty({
        name: 'Count',
        type: 'u',
        getter: (): number => greeted // read-only: no setter
    })
    .defineSignal({
        name: 'Greeted',
        args: [{name: 'name', type: 's'}, {name: 'count', type: 'u'}],
        eventEmitter: events
    })

const startedAt: string = new Date().toISOString()
const object: LocalObject = new LocalObject('/org/example/Greeter')
object.addInterface(greeter)
const service: LocalService = new LocalService('org.example.Greeter')
service.addObject(object)

// Connects (to the session bus without options) and requests the name
const result: RequestNameResultCode = await service.run()
if (result !== RequestNameResultCode.DBUS_REQUEST_NAME_REPLY_PRIMARY_OWNER) {
    console.error('org.example.Greeter is already taken')
    await service.stop()
    process.exit(1)
}
console.log('org.example.Greeter is ready')

const shutdown = async (): Promise<void> => {
    await service.stop({graceful: true, timeout: 5000})
    console.log('stopped')
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
