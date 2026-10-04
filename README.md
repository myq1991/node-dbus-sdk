# dbus-sdk

[![npm version](https://badge.fury.io/js/dbus-sdk.svg)](https://badge.fury.io/js/dbus-sdk)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/myq1991/node-dbus-sdk/blob/main/LICENSE)

A DBus library for Node.js, written in TypeScript. Use it to call services and to provide your own. It implements the
DBus wire protocol itself, over Unix sockets, TCP or any stream, so it needs no native modules and no libdbus.

- **Client**: proxies built from introspection, so you call methods and use properties and signals with plain
  JavaScript values.
- **Service**: define methods, properties and signals. Introspection, `Properties`, `Peer` and `ObjectManager` are
  answered for you.
- **Correct on the wire**: values are validated against their types. The encoding is tested byte for byte against
  GDBus and libdbus, and against a real `dbus-daemon`.

```typescript
import {DBus} from 'dbus-sdk'

const bus = await DBus.connect()   // the session bus
const daemon = await bus.getInterface('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus')
console.log(await daemon.method.ListNames())
await bus.disconnect()
```

## Contents

- [Installation](#installation)
- [Connecting](#connecting)
- [Calling a service](#calling-a-service)
- [Providing a service](#providing-a-service)
- [Types](#types)
- [Errors](#errors)
- [Limitations](#limitations)
- [Examples](#examples) · [API reference](#api-reference) · [Upgrading from 1.x](#upgrading-from-1x) · [Development](#development)

## Installation

```bash
npm install dbus-sdk
```

- Node.js 18 or later. Type declarations are included.
- A DBus bus to connect to. Linux systems run a system bus and, in desktop sessions, a session bus. On macOS,
  `brew install dbus` provides `dbus-daemon`.

## Connecting

```typescript
import {DBus} from 'dbus-sdk'

const session = await DBus.connect()                                                         // DBUS_SESSION_BUS_ADDRESS
const system = await DBus.connect({busAddress: 'unix:path=/run/dbus/system_bus_socket'})    // the system bus
const remote = await DBus.connect({busAddress: 'tcp:host=192.168.1.10,port=55556'})
```

| Option | Meaning |
|---|---|
| none, or `busAddress` unset | The session bus, from `DBUS_SESSION_BUS_ADDRESS`. Throws `UnknownBusAddressError` when it is not set. |
| `busAddress` | A DBus address, `unix:path=…` or `tcp:host=…,port=…`, or a `;`-separated list tried in order. |
| `socket` / `host` + `port` / `stream` | A Unix socket path, a TCP endpoint, or a `Duplex` stream you opened. |
| `timeout` | Milliseconds to wait for the connection (default 20000). |
| `callTimeout` | Default milliseconds to wait for each method reply (default: no limit). |
| `authMethods` | Authentication mechanisms to try, in order (default `['EXTERNAL', 'DBUS_COOKIE_SHA1', 'ANONYMOUS']`). |
| `convertBigIntToNumber` | Return 64-bit integers as `number` instead of `bigint`. Values beyond 2⁵³ lose precision. |
| `advancedResponse` | Return received values as type class instances that keep their DBus type (see [Types](#types)). |

`bus.uniqueName` is the connection's name on the bus, e.g. `:1.42`. `await bus.disconnect()` closes the connection.

## Calling a service

### Through a proxy

`getInterface` introspects the object and returns a proxy. Arguments take their types from the introspected
signatures, so plain values are enough.

```typescript
const greeter = await bus.getInterface('org.example.Greeter', '/org/example/Greeter', 'org.example.Greeter1')

const message = await greeter.method.Greet('Alice')     // one return value: the value itself
const [count, since] = await greeter.method.Stats()     // several: an array
await greeter.method.Reset()                            // none: undefined
await greeter.namedMethod.Greet({name: 'Bob'})          // arguments by name instead of position
greeter.noReplyMethod.Ping()                            // send without waiting for a reply

const greeting = await greeter.property.Greeting.get()
await greeter.property.Greeting.set('Howdy')

greeter.signal.on('Greeted', (name: string, count: number) => console.log(name, count))
```

`bus.getService(name)` and `bus.getObject(name, path)` return proxies for a whole service or object. On them,
`listObjectPaths()`, `listInterfaceNames()` and `introspect()` explore what is there (see
[07-introspect.ts](examples/07-introspect.ts)). `getService` starts a service that is activatable but not running.

### Following an object manager

Services with many objects that come and go, such as BlueZ, UDisks2 and NetworkManager, publish them through
`org.freedesktop.DBus.ObjectManager`. `getObjectManager` keeps a copy of those objects with their interfaces and
properties, and tells you when they change.

```typescript
const manager = await bus.getObjectManager('org.bluez')       // the manager's path: '/' by default
for (const path of manager.listObjectPaths()) {
    console.log(path, manager.listInterfaceNames(path), manager.getProperties(path, 'org.bluez.Device1'))
}
manager.on('objectAdded', (path, interfaces) => { /* {interface: {property: value}} */ })
manager.on('objectRemoved', (path, interfaceNames) => { /* ... */ })
manager.on('interfacesAdded', (path, interfaces) => { /* an existing object gained interfaces */ })
manager.on('interfacesRemoved', (path, interfaceNames) => { /* ... */ })
manager.on('propertiesChanged', (path, iface, changed, invalidated) => { /* the copy is already updated */ })

const device = await manager.getInterface('/org/bluez/hci0/dev_00_11_22_33_44_55', 'org.bluez.Device1')
await device.method.Connect()
manager.close()
```

When the service leaves the bus, its objects are removed with `objectRemoved`. When it comes back, they are read
again. All the properties are followed with a single match rule.

### Without introspection

`invoke` takes the signature explicitly. It always resolves to the array of returned values.

```typescript
const [owner] = await bus.invoke({
    service: 'org.freedesktop.DBus',
    objectPath: '/org/freedesktop/DBus',
    interface: 'org.freedesktop.DBus',
    method: 'GetNameOwner',
    signature: 's',
    args: ['org.example.Greeter'],
    timeout: 5000              // optional; noReply: true sends without waiting
})

const target = {service: 'org.example.Greeter', objectPath: '/org/example/Greeter', interface: 'org.example.Greeter1'}
const greeting = await bus.getProperty({...target, property: 'Greeting'})
await bus.setProperty({...target, property: 'Greeting', value: 'Hi', signature: 's'})   // give the type: 's'
```

The bus's own methods have helpers: `listNames`, `getNameOwner`, `nameHasOwner`, `requestName`, `releaseName`,
`listActivatableNames`, `startServiceByName`, `getConnectionUnixProcessID`.

### Signals and bus events

```typescript
// One service's interface: follows the service when it restarts under a new unique name
greeter.signal.on('Greeted', (name, count) => { /* ... */ })

// Any sender: '*' matches anything. The listener gets the signal's arguments.
const clock = bus.createSignalEmitter({service: '*', uniqueName: '*', objectPath: '*', interface: 'org.example.Clock1'})
clock.on('Tick', (count, time) => { /* ... */ })
clock.on('*', (signalName, ...args) => { /* every signal the emitter selects */ })
clock.onAny((signal) => { /* the same, with signal.sender, .objectPath, .interface, .name and .args */ })

// Names appearing on and leaving the bus (unique names too)
bus.on('serviceOnline', (name) => { /* ... */ })
bus.on('serviceOffline', (name) => { /* ... */ })
```

Listening adds a match rule on the bus, and removing the last listener removes it. The rule is sent without waiting
for an answer. A signal sent by another connection right after you subscribe can reach the bus before the rule does.
Any call on the same connection is answered after the bus has processed the rule, so once a call has returned, the
signal is certain to arrive.

Other events of `DBus`: `serviceReplaced`, `nameOwnerChanged(name, oldOwner, newOwner)`, `nameAcquired`, `nameLost`,
`connectionClose`, `connectionError`, `methodCall`.

## Providing a service

A service is a `LocalService` holding `LocalObject`s, which hold `LocalInterface`s.

```typescript
import EventEmitter from 'node:events'
import {createDBusError, LocalInterface, LocalObject, LocalService, RequestNameResultCode} from 'dbus-sdk'

let greeting = 'Hello'
const events = new EventEmitter()

const iface = new LocalInterface('org.example.Greeter1')
    .defineMethod({
        name: 'Greet',
        inputArgs: [{name: 'name', type: 's'}],
        outputArgs: [{name: 'message', type: 's'}],
        method: (name: string): string => {
            events.emit('Greeted', name)                   // sends the Greeted signal
            return `${greeting}, ${name}!`
        }
    })
    .defineMethod({
        name: 'Divide',
        inputArgs: [{type: 'd'}, {type: 'd'}],
        outputArgs: [{type: 'd'}],
        method: (a: number, b: number): number => {
            if (b === 0) throw createDBusError('org.example.Greeter1.Error.DivisionByZero', 'Cannot divide by zero')
            return a / b
        }
    })
    .defineProperty({
        name: 'Greeting',
        type: 's',
        emitPropertiesChanged: true,                       // announce changes made through Set
        getter: (): string => greeting,
        setter: (value: string): void => { greeting = value }
    })
    .defineSignal({name: 'Greeted', args: [{name: 'name', type: 's'}], eventEmitter: events})

const object = new LocalObject('/org/example/Greeter')
object.addInterface(iface)
const service = new LocalService('org.example.Greeter')
service.addObject(object)

if (await service.run() !== RequestNameResultCode.DBUS_REQUEST_NAME_REPLY_PRIMARY_OWNER) {
    console.error('the name is taken')
}
process.once('SIGTERM', () => service.stop({graceful: true, timeout: 5000}))
```

**Methods**

- The handler receives the input arguments in order, as plain values (see [Types](#types)). It may be `async`.
- It returns the value of the single output argument, which may itself be an array (for `as`) or an object (for
  `a{sv}`). With several output arguments, it returns an array holding one value per argument.
- A thrown error becomes a DBus error reply. `createDBusError(name, message)` sets the DBus error name. Any other
  error is named `<service name>.<error name>`.
- With `withContext: true`, the handler gets a last extra argument describing the call. Its `sender` is the caller's
  unique name, for access control.

**Properties**

- The access mode follows the functions you give: `getter` → read, `setter` → write, both → readwrite.
- A setter may be `async`. If it throws, the caller of `Set` gets the error.
- With `emitPropertiesChanged`, a change made through the setter sends `PropertiesChanged`. That covers a DBus `Set`
  call and `iface.setProperty(name, value)` from your code. Use `{emitValue: false}` to send the property as
  invalidated instead of sending its value.
- Announce a change made another way, for example to a read-only property the service updates itself, with
  `iface.emitPropertiesChanged('Name')` (or a list of names). Clients that cache properties, such as proxies and
  object manager clients, rely on these signals. Changes announced in the same turn of the event loop go out in one
  signal.
- A property whose getter throws is left out of `GetAll` and the object manager's reports. `Get` returns the error.

**Signals** are sent when the `eventEmitter` given to `defineSignal` emits an event with the signal's name. The
event's arguments become the signal's arguments.

**Objects** can be added and removed while the service runs. The root object `/` always exists; do not add another
object at `/`.

**Object manager.** `org.freedesktop.DBus.ObjectManager` lists the objects below it (`GetManagedObjects`) and
announces each change with `InterfacesAdded` and `InterfacesRemoved`.

- By default it is on `/`, as BlueZ does.
- `new LocalService(name, {objectManagerPath: '/org/example/App'})` puts it on that path, as UDisks2 does, so it
  manages only the objects below. Add interfaces to that object with `service.getObject(path)`.
- `objectManagerPath: null` leaves it out.
- To nest managers, add `new ObjectManagerInterface()` to another object. Each object is reported by the nearest
  manager above it, never by a manager on its own path.

**Annotations**: give `annotations: {'org.freedesktop.DBus.Deprecated': 'true'}` on methods, arguments, properties
or signals, or call `defineAnnotation` on the interface. They appear in the introspection data.

**Running and stopping**

- `run(opts)` takes the same options as `DBus.connect`, plus `flags` for requesting the name.
- A taken name does not make `run` fail. The service queues for the name, so check the result. To fail instead, pass
  `flags: RequestNameFlags.DBUS_NAME_FLAG_DO_NOT_QUEUE`.
- `stop()` releases the name and disconnects at once. `stop({graceful: true, timeout})` first lets the calls in
  progress finish.

## Types

How DBus types map to JavaScript values, in both directions. [05-types.ts](examples/05-types.ts) shows each case.

| DBus | You send | You receive |
|---|---|---|
| `y` `n` `q` `i` `u` (integers up to 32 bits) | `number` (or `bigint`) | `number` |
| `x` `t` (64-bit integers) | `bigint`, `number` or decimal string | `bigint` (`number` with `convertBigIntToNumber`) |
| `d` (double) | `number` | `number` |
| `b` (boolean) | `true` / `false` (or `1` / `0`) | `boolean` |
| `s` `o` `g` (string, object path, signature) | `string` | `string` |
| `ay` (bytes) | `Buffer`, `Uint8Array` or `number[]` | `Buffer` |
| `a…` (array) | array | array |
| `a{…}` (dictionary) | object, `Map`, or array of `[key, value]` pairs | object (keys become strings) |
| `(…)` (struct) | array of the fields | array of the fields |
| `v` (variant) | any value; its type is inferred (below) | the content's value (its type is not kept) |
| `h` (file descriptor) | not supported | not supported |

**Variants.** A plain value given for `v` is sent with an inferred type:

- `string` → `s`, `boolean` → `b`, `bigint` → `x`, `Buffer` → `ay`.
- An integer → `i`. An integer outside the INT32 range → `x`. Any other number → `d`.
- An array → `a` plus the items' type. Items of different types make a struct instead, e.g. `[1, 'a']` → `(is)`.
- A `Map` → `a{…v}` keyed by its keys' type. Any other object → `a{sv}`.

`DBusSignedValue.inferSignature(value)` tells you which signature a value gets. To choose a type yourself, wrap the
value as `new DBusSignedValue('u', 7)`, or use a type class: `new DBusUInt32(7)`, `new DBusObjectPath('/a')`, and so
on, one per DBus type. These work anywhere a value goes, and are most useful inside variants and `a{sv}`.

**Validation.** Values that the DBus specification does not allow are rejected with an `InvalidValueError`,
`SignatureError` or `ObjectPathError` before anything is sent.

- Integers must be integers within their type's range.
- `b` accepts only `true`, `false`, `1` and `0`.
- `d` requires a number.
- Strings must not contain NUL characters or lone UTF-16 surrogates.
- `o` and `g` must be a valid object path or signature.
- Signatures must follow the structural rules: no empty structs; dict entries only as array elements and with a basic
  key type; at most 32 nested arrays and 32 nested structs; at most 255 characters.

Received data is checked the same way. A message with invalid UTF-8, malformed paths or signatures, non-zero padding,
or arrays over 64 MiB is reported as an error instead of being decoded.

## Errors

- **Errors from the other side** of a call reject with an `Error`. Its `name` is the DBus error name (e.g.
  `org.freedesktop.DBus.Error.UnknownMethod`) and its `message` is the error text.
- **Errors from this library** are classes whose `name` is the class name. Each also has a stable `code` and `errno`.
  The most common:
  - `TimeoutError`: no reply within the timeout.
  - `InvalidValueError`, `SignatureError`, `ObjectPathError`: a value does not fit its type.
  - `ServiceNotFoundError`, `InterfaceNotFoundError`: what you asked for is not on the bus.
  - `AccessPropertyForbiddenError`: you read or wrote a property against its access mode.
  - `UnknownBusAddressError`, `AuthError`: connecting failed.
- **Calls pending when the connection closes** reject with `org.freedesktop.DBus.Error.Disconnected`.
- A call without a timeout waits until it is answered or the connection closes. Set `callTimeout` when a service
  might never answer.

## Limitations

- **No file descriptor passing (`h`).** Node.js sockets cannot send or receive file descriptors. Methods that pass
  them, such as logind's `Inhibit` or BlueZ's `Acquire`, cannot be used. Messages containing `h` are rejected.
- **The system bus needs its address.** Without options, `DBus.connect()` connects to the session bus only.
- **Only `unix:path=` and `tcp:` addresses.** `unix:abstract=`, `unix:tmpdir=` and other transports are not
  supported. In a `;`-separated list, they are skipped in favour of the next address.
- **Messages are decoded whole.** There is no streaming of large values. Received arrays over 64 MiB are rejected.

## Examples

[examples/](examples/README.md) holds complete programs covering connecting, a service and its client, signals,
types, ObjectManager and introspection. The test suite runs each of them against a real bus.

## API reference

Every public class, method and type has documentation in the type declarations, which your editor shows. The
declarations include examples for the main entry points. [doc/API.md](doc/API.md) gives an overview by class.

## Upgrading from 1.x

Version 2.0 renames part of the API and validates values strictly. [MIGRATION.md](MIGRATION.md) lists every change
and how to update code.

## Development

```bash
npm test                 # build, then unit and integration tests (integration tests need dbus-daemon)
npm run test:unit        # without a bus
npm run example -- examples/01-bus-basics.ts
npx eslint --ext .ts src
```

## License

[MIT](LICENSE)
