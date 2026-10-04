/**
 * Signals and bus events: emitting signals, subscribing to them with match rules, and following which names appear
 * on and leave the bus. The example uses two connections, one sending and one listening, so it needs nothing else.
 *
 * Run: node examples/04-signals.ts   (in this repository: npm run example -- examples/04-signals.ts)
 */
import {DBus, type DBusSignalEmitter} from 'dbus-sdk'

const listener: DBus = await DBus.connect()
const sender: DBus = await DBus.connect()

// Bus events, from the bus's NameOwnerChanged signal: a name got an owner, lost it, or changed owner. They also fire
// for unique names, e.g. serviceOffline(':1.4') when a connection closes.
listener.on('serviceOnline', (name: string): void => console.log('online:', name))
listener.on('serviceOffline', (name: string): void => console.log('offline:', name))

// A signal emitter selects signals by sender, object path and interface; '*' matches any. Listening to an event adds
// a match rule on the bus, so the bus forwards those signals; removing the last listener removes the rule.
const anySender: DBusSignalEmitter = listener.createSignalEmitter({
    service: '*',
    uniqueName: '*', // the sender's unique name, e.g. ':1.42'
    objectPath: '/org/example/Clock',
    interface: 'org.example.Clock1'
})
const ticks: Promise<void> = new Promise((resolve): void => {
    let received: number = 0
    // The event is the signal's name; the listener receives the signal's arguments
    anySender.on('Tick', (count: number, time: string): void => {
        console.log(`Tick #${count} at ${time}`)
        if (++received === 3) resolve()
    })
})
// '*' receives every signal the emitter selects, with the signal name first
anySender.on('*', (signalName: string, ...args: unknown[]): void => console.log('  (any signal)', signalName, args))

// The match rule is sent without waiting for an answer. Any call on the same connection is answered after the bus has
// processed it, so after this round trip signals sent by other connections are sure to be forwarded.
await listener.nameHasOwner('org.freedesktop.DBus')

// To follow one service by its well-known name, use the proxy's emitter instead: dbus.getInterface(...).signal.
// It keeps working when the service restarts under a new unique name.

// Emit signals: object path, interface, name, signature and arguments. Without destination they are broadcast.
for (let count: number = 1; count <= 3; count++) {
    sender.emitSignal({
        objectPath: '/org/example/Clock',
        interface: 'org.example.Clock1',
        signal: 'Tick',
        signature: 'us',
        data: [count, new Date().toISOString()]
    })
}
await ticks

// A name appearing and leaving produces serviceOnline and serviceOffline
const offline: Promise<void> = new Promise((resolve): void => {
    listener.once('serviceOffline', (): void => resolve())
})
await sender.requestName('org.example.Clock')
await sender.releaseName('org.example.Clock')
await offline

anySender.removeAllListeners() // removes the match rule
await sender.disconnect()
await listener.disconnect()
