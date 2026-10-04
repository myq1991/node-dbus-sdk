# API reference

<!-- Generated from the type declarations and their documentation by src/tests/tools/ApiDoc.ts: run `npm run docs:api` after changing the public API. A unit test fails when this file is out of date. -->

Everything below is exported by `dbus-sdk`. For a guided introduction see the [README](../README.md); for
complete programs see [examples](../examples/README.md).

- [Client](#client): `DBus`, `DBusService`, `DBusObject`, `DBusInterface`, `DBusSignalEmitter`, `DBusObjectManager`
- [Service](#service): `LocalService`, `LocalObject`, `LocalInterface`, `createDBusError`, `PropertiesInterface`, `IntrospectableInterface`, `PeerInterface`, `ObjectManagerInterface`
- [Values and signatures](#values-and-signatures): `DBusSignedValue`, `Signature`, `RequestNameFlags`, `RequestNameResultCode`, `DBusPropertyAccess`, `DBusMessageType`, `DBusMessageFlags`, `DBusMessageEndianness`
- [Type classes](#type-classes): `DBusArray`, `DBusBoolean`, `DBusByte`, `DBusDictEntry`, `DBusDouble`, `DBusInt16`, `DBusInt32`, `DBusInt64`, `DBusObjectPath`, `DBusSignature`, `DBusString`, `DBusStruct`, `DBusUInt16`, `DBusUInt32`, `DBusUInt64`, `DBusUnixFD`, `DBusVariant`
- [Errors](#errors): `AccessPropertyForbiddenError`, `AlignmentError`, `AuthError`, `CreateStreamFailedError`, `InterfaceNotFoundError`, `InvalidValueError`, `LocalInterfaceExistsError`, `LocalInterfaceInvalidAnnotationError`, `LocalInterfaceInvalidMethodNameError`, `LocalInterfaceInvalidNameError`, `LocalInterfaceInvalidPropertyNameError`, `LocalInterfaceInvalidSignalNameError`, `LocalInterfaceMethodDefinedError`, `LocalInterfacePropertyDefinedError`, `LocalInterfaceSignalDefinedError`, `LocalObjectInvalidNameError`, `LocalObjectPathExistsError`, `LocalServiceInvalidNameError`, `MessageDecodeError`, `NotEnoughParamsError`, `ObjectPathError`, `ReadBufferError`, `SerialError`, `ServiceNotFoundError`, `SignatureError`, `TimeoutError`, `UnknownBusAddressError`, `UnknownBusTypeError`, `UserPermissionError`
- [Low level](#low-level): `DBusConnection`, `DBusMessage`, `DBusBufferEncoder`, `DBusBufferDecoder`
- [Option and data types](#option-and-data-types): `BusAddressConnectOpts`, `BusNameBasicInfo`, `ConnectOpts`, `CreateConnectOpts`, `CreateSignalEmitterOpts`, `DataType`, `DBusInterfaceOpts`, `DBusMessageHeader`, `DBusObjectManagerOpts`, `DBusObjectOpts`, `DBusServiceOpts`, `DBusTypeCode`, `DecodeOpts`, `DefineMethodArgumentOpts`, `DefineMethodOpts`, `DefinePropertyOpts`, `DefineSignalArgumentOpts`, `DefineSignalOpts`, `EmitPropertiesChangedOpts`, `EmitSignalOpts`, `GetPropertyValueOpts`, `HandshakeOpts`, `IntrospectAnnotation`, `IntrospectInterface`, `IntrospectMethod`, `IntrospectMethodArgument`, `IntrospectNode`, `IntrospectProperty`, `IntrospectSignal`, `IntrospectSignalArgument`, `InvokeOpts`, `LocalServiceOpts`, `MethodCall`, `MethodCallContext`, `NamedMethodCall`, `NamedNoReplyMethodCall`, `NoReplyMethodCall`, `PropertyOperation`, `ProxyOpts`, `ReceivedSignal`, `ReplyOpts`, `SetPropertyValueOpts`, `SocketConnectOpts`, `StopServiceOpts`, `StreamConnectOpts`, `TCPConnectOpts`

## Client

Connecting to a bus and using the services on it.

### class `DBus` (extends EventEmitter)

Main class for interacting with a DBus connection.
Provides methods for connecting to DBus, invoking methods, handling signals,
managing services, objects, and interfaces, and other DBus operations.
Extends EventEmitter to emit events for connection status and DBus signals.

#### `callTimeout: number | undefined`

Default number of milliseconds to wait for a method call's reply before rejecting it with a TimeoutError,
for calls without their own timeout (see InvokeOpts.timeout). Undefined means no timeout.

#### `readonly uniqueName: string`

Getter for the unique name of this DBus connection.

Returns: The unique name assigned by the DBus daemon (e.g., ':1.123').

#### `readonly connected: boolean`

Whether the connection is open. It becomes false when the connection closes, from disconnect() or because the
bus went away; 'connectionClose' is emitted then.

#### `DBus.connect(opts?: CreateConnectOpts): Promise<DBus>`

Connects to a bus, authenticates, and registers with it (Hello), which gives the connection its unique name.

Where it connects:
- no options, or no address: the session bus, from the DBUS_SESSION_BUS_ADDRESS environment variable
- `{busAddress}`: a DBus address, e.g. 'unix:path=/run/dbus/system_bus_socket' for the system bus,
  'tcp:host=127.0.0.1,port=12345', or a ';'-separated list tried in order
- `{socket}`: the path of a Unix socket; `{host, port}`: TCP; `{stream}`: a Duplex stream you opened

- `opts`: Where and how to connect; see above. `callTimeout` sets a default reply timeout for every call, `authMethods` the authentication mechanisms to try (default EXTERNAL, then DBUS_COOKIE_SHA1, then ANONYMOUS).

```typescript
const sessionBus = await DBus.connect()
const systemBus = await DBus.connect({busAddress: 'unix:path=/run/dbus/system_bus_socket'})
const bus = await DBus.connect({busAddress: 'tcp:host=127.0.0.1,port=12345', callTimeout: 5000})
```

Returns: The connected DBus instance.

Throws: {UnknownBusAddressError} Without an address when DBUS_SESSION_BUS_ADDRESS is not set.

Throws: {CreateStreamFailedError | TimeoutError | AuthError} When no address can be connected to in time, or
authentication fails.

#### `write(data: Buffer): void`

Writes raw data to the DBus socket.
Throws an error if the connection is not active.
Used internally to send encoded DBus messages to the daemon.

- `data`: The Buffer containing the data to write to the DBus socket.

Throws: {Error} If the DBus connection is disconnected, with a specific DBus error code.

#### `emitSignal(opts: EmitSignalOpts): void`

Sends a signal from this connection: to everyone whose match rules select it, or to `destination` only.
LocalInterface.defineSignal sends signals for you; this is the low-level form.

- `opts`: Object path, interface and signal name, the data's signature and values, and an optional destination.

```typescript
bus.emitSignal({objectPath: '/org/example/Clock', interface: 'org.example.Clock1', signal: 'Tick', signature: 'us', data: [1, new Date().toISOString()]})
```

Throws: {InvalidValueError | SignatureError} When the data does not fit the signature.

#### `reply(opts: ReplyOpts): void`

Sends a reply to a DBus method call.
Handles both successful responses (METHOD_RETURN) and error replies (ERROR).
Encodes the reply message and writes it to the DBus socket.

- `opts`: Options for the reply, including reply serial number, destination, signature, and data or error object.

#### `invoke`

```typescript
invoke(opts: InvokeOpts & { noReply: true; }): void
invoke(opts: InvokeOpts & { noReply?: false; }): Promise<any[]>
invoke(opts: InvokeOpts): Promise<any[]> | void
```

Calls a method without introspection. `args` are plain values (or DBusSignedValue / type class instances) typed
by `signature`, which must describe all of them, e.g. 'su' for a string and a UINT32. For calls with types
from introspection, use getInterface(...).method instead.

Resolves with the array of the reply's values, even for one or none (`const [value] = await bus.invoke(...)`).
Rejects with the error the service replied with, whose `name` is the DBus error name, with a TimeoutError after
`timeout` (or the connection's callTimeout), or with an error named 'org.freedesktop.DBus.Error.Disconnected'
when the connection closes first. With `noReply: true`, nothing is waited for and nothing is returned.

- `opts`: Destination service, object path, interface, method, signature and args; optionally timeout and noReply.

```typescript
const [owner] = await bus.invoke({
    service: 'org.freedesktop.DBus', objectPath: '/org/freedesktop/DBus', interface: 'org.freedesktop.DBus',
    method: 'GetNameOwner', signature: 's', args: ['org.example.Greeter'], timeout: 5000
})
```

Returns: The reply's values, or nothing when no reply is expected.

Throws: {InvalidValueError | SignatureError} When the args do not fit the signature: the returned promise rejects,
or, with noReply, invoke throws.

#### `getProperty(opts: GetPropertyValueOpts): Promise<any>`

Reads a property with org.freedesktop.DBus.Properties.Get, without introspection.

- `opts`: Service, object path, interface and property name.

```typescript
const features = await bus.getProperty({service: 'org.freedesktop.DBus', objectPath: '/org/freedesktop/DBus', interface: 'org.freedesktop.DBus', property: 'Features'})
```

Returns: The property's value as a plain value.

Throws: {Error} The DBus error the service replied with, e.g. 'org.freedesktop.DBus.Error.UnknownProperty'.

#### `setProperty(opts: SetPropertyValueOpts): Promise<void>`

Writes a property with org.freedesktop.DBus.Properties.Set, without introspection. Give the value's type with
`signature`, or as a DBusSignedValue; otherwise it is inferred as for a variant (e.g. 5 is sent as 'i'), which
services usually reject for a property of another type.

- `opts`: Service, object path, interface, property name, value, and the value's signature.

Returns: Resolves when the service has accepted the value.

Throws: {Error} The DBus error the service replied with, e.g. 'org.freedesktop.DBus.Error.InvalidArgs'.

#### `createSignalEmitter(opts: CreateSignalEmitterOpts): DBusSignalEmitter`

Creates an emitter for the signals selected by sender, object path and interface, where '*' matches any.
Listen with the signal's name as the event (or '*' for every signal, with the name first): the listener gets
the signal's arguments. Listening adds a match rule on the bus; removing the last listener removes it.

Signals are matched by the sender's unique name: `uniqueName` is the sender (e.g. ':1.42', or '*'), and
`service` the well-known name whose owner changes it follows. For one service's interface,
getInterface(...).signal is simpler; the rule takes effect once the bus has processed it, which any later
call on this connection waits for.

- `opts`: The sender's well-known and unique names, the object path and the interface, each possibly '*'.

```typescript
const emitter = bus.createSignalEmitter({service: '*', uniqueName: '*', objectPath: '*', interface: 'org.example.Clock1'})
emitter.on('Tick', (count, time) => console.log(count, time))
```

Returns: The signal emitter.

#### `new DBus(connection: DBusConnection): DBus`

Constructor for the DBus class.
Initializes the DBus instance with a connection and sets up event listeners for
incoming messages, connection closure, and errors. Dispatches signals to emitters.

- `connection`: The DBusConnection instance to use for low-level communication.

#### `on(eventName, listener)`

Listens to an event of this DBus:

| Event | Listener arguments | Emitted when |
|---|---|---|
| `serviceOnline` | `(name: string)` | when a bus name gets an owner: a service starts, or a connection (unique name) appears |
| `serviceOffline` | `(name: string)` | when a bus name loses its owner: a service stops, or a connection (unique name) closes |
| `serviceReplaced` | `(name: string)` | when a bus name passes from one owner to another |
| `methodCall` | `(message: DBusMessage)` | when a method call is received |
| `nameOwnerChanged` | `(name: string, oldOwner: string, newOwner: string)` | when a bus name owner changes |
| `nameLost` | `(name: string)` | when a bus name is lost by this connection |
| `nameAcquired` | `(name: string)` | when a bus name is acquired by this connection |
| `connectionClose` | `()` | when the DBus connection is closed |
| `connectionError` | `(error: Error)` | when an error occurs on the DBus connection |

#### `once(eventName, listener)`

The same events as `on`.

#### `off(eventName, listener)`

The same events as `on`.

#### `removeListener(eventName, listener)`

The same events as `on`.

#### `addMatch(rule: string): void`

Adds a match rule to receive specific signals from the DBus daemon.
Sends a method call to the DBus daemon to register the rule without waiting for a reply.

- `rule`: The match rule string specifying which signals to receive (e.g., 'type=signal,interface=org.test').

#### `removeMatch(rule: string): void`

Removes a previously added match rule from the DBus daemon.
Sends a method call to the DBus daemon to unregister the rule without waiting for a reply.

- `rule`: The match rule string to remove, previously added with addMatch.

#### `getNameOwner(name: string): Promise<string | undefined>`

Retrieves the unique name of the owner of a given bus name.
Queries the DBus daemon to get the current owner of a well-known bus name.

- `name`: The bus name to query (e.g., 'org.freedesktop.DBus').

Returns: A Promise resolving to the unique name of the owner (e.g., ':1.123') or undefined if not found or an error occurs.

#### `listActivatableNames(): Promise<string[]>`

Lists all activatable bus names (services that can be started).
Retrieves a list of service names that are registered as activatable with the DBus daemon.

Returns: A Promise resolving to an array of activatable bus names (e.g., ['org.test.Service']).

#### `listNames(): Promise<string[]>`

Lists all currently active bus names.
Retrieves a list of service names that are currently active (have an owner) on the bus.

Returns: A Promise resolving to an array of active bus names (e.g., ['org.test.Service', ':1.123']).

#### `nameHasOwner(name: string): Promise<boolean>`

Checks if a given bus name currently has an owner.
Queries the DBus daemon to determine if a specific bus name is currently owned by a connection.

- `name`: The bus name to check (e.g., 'org.test.Service').

Returns: A Promise resolving to a boolean indicating if the name has an owner (true) or not (false).

#### `requestName(name: string, flags?: RequestNameFlags): Promise<RequestNameResultCode>`

Requests ownership of a bus name with specified flags.
Attempts to acquire a well-known bus name for this connection, with options for behavior on conflict.

- `name`: The bus name to request (e.g., 'org.my.Service').
- `flags`: Optional flags for the request behavior (default: RequestNameFlags.DBUS_NAME_FLAG_DEFAULT).

Returns: A Promise resolving to a result code indicating success or the reason for failure (e.g., RequestNameResultCode.DBUS_REQUEST_NAME_REPLY_PRIMARY_OWNER).

#### `releaseName(name: string): Promise<number>`

Releases ownership of a bus name.
Releases a previously acquired well-known bus name, allowing others to claim it.

- `name`: The bus name to release (e.g., 'org.my.Service').

Returns: A Promise resolving to a numeric result code indicating the outcome of the release operation.

#### `reloadConfig(): Promise<void>`

Reloads the DBus daemon configuration.
Requests the DBus daemon to reload its configuration files, typically for administrative purposes.

Returns: A Promise that resolves when the configuration reload request is sent and processed.

#### `startServiceByName(name: string, flags?: number): Promise<number>`

Starts a service by its bus name.
Requests the DBus daemon to activate a service if it is activatable and not currently running.

- `name`: The bus name of the service to start (e.g., 'org.my.Service').
- `flags`: Optional flags for starting the service (default: 0, no specific flags).

Returns: A Promise resolving to a numeric result code indicating the outcome of the start operation.

#### `getConnectionUnixProcessID(name: string): Promise<number | undefined>`

Retrieves the Unix process ID of a connection by its bus name.
Queries the DBus daemon to get the PID of the process owning a specific bus name.

- `name`: The bus name of the connection (e.g., 'org.my.Service' or ':1.123').

Returns: A Promise resolving to the process ID as a number, or undefined if not found or an error occurs.

#### `disconnect(): Promise<void>`

Closes the connection. Calls still waiting for a reply are rejected with
'org.freedesktop.DBus.Error.Disconnected', and 'connectionClose' is emitted.

Returns: Resolves when the connection is closed.

#### `listBusNames(): Promise<BusNameBasicInfo[]>`

Lists all bus names, including active and activatable ones, with detailed information.
Combines active and activatable names, fetching additional details like owner and PID.

Returns: A Promise resolving to an array of bus name information objects, including name, unique name, active status, activatable status, and PID.

#### `listServices(): Promise<BusNameBasicInfo[]>`

Lists all services (bus names that are not unique connection names).
Filters out unique connection names (e.g., ':1.123') to return only well-known service names.

Returns: A Promise resolving to an array of service information objects, excluding unique connection names.

#### `getServices(): Promise<DBusService[]>`

Retrieves the running services as DBusService instances.
Activatable services that are not running are left out rather than started; use getService(name) to start one.

Returns: A Promise resolving to an array of DBusService instances for the services currently on the bus.

#### `getService(service: string): Promise<DBusService>`

A proxy for a service by its well-known name. A service that is not running but activatable is started.

- `service`: The well-known name, e.g. 'org.freedesktop.NetworkManager'.

Returns: The service proxy.

Throws: {ServiceNotFoundError} When no connection owns the name and it is not activatable, or activation does
not give it an owner.

#### `getObject(service: string, objectPath: string): Promise<DBusObject>`

A proxy for an object of a service; see getService. The path itself is not checked.

- `service`: The service's well-known name.
- `objectPath`: The object path, e.g. '/org/freedesktop/NetworkManager'.

Returns: The object proxy.

Throws: {ServiceNotFoundError} As getService.

#### `getObjectManager(service: string, objectPath?: string, opts?: ProxyOpts): Promise<DBusObjectManager>`

A client for a service's org.freedesktop.DBus.ObjectManager, holding an up-to-date copy of the objects it
manages with their interfaces and properties. A service that is not running but activatable is started.

- `service`: The service's well-known name.
- `objectPath`: Path of the service's object manager (default '/'). Services document it; BlueZ uses '/', UDisks2 '/org/freedesktop/UDisks2'.
- `opts`: decode: how property values are given (see DecodeOpts).

```typescript
const manager = await bus.getObjectManager('org.freedesktop.UDisks2', '/org/freedesktop/UDisks2')
manager.on('objectAdded', (path, interfaces) => console.log(path, Object.keys(interfaces)))
```

Returns: The object manager client, with its objects loaded.

Throws: {ServiceNotFoundError} As getService.

Throws: {Error} The DBus error GetManagedObjects failed with, e.g. 'org.freedesktop.DBus.Error.UnknownMethod'
when the path has no object manager.

#### `getInterface(service: string, objectPath: string, iface: string, opts?: ProxyOpts): Promise<DBusInterface>`

A proxy for an interface of an object, built by introspecting the object. This is the usual way to call
methods, use properties and receive signals of a service.

- `service`: The service's well-known name.
- `objectPath`: The object path.
- `iface`: The interface name.
- `opts`: decode: how the proxy gives the values it receives, e.g. {types: 'variants'} to read values that will be sent back (see DecodeOpts).

```typescript
const iface = await bus.getInterface('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus')
const id = await iface.method.GetId()
```

Returns: The interface proxy.

Throws: {ServiceNotFoundError} As getService.

Throws: {InterfaceNotFoundError} When the object's introspection data does not list the interface.

### class `DBusService`

A proxy for a service on the bus, by its well-known name (e.g. 'org.freedesktop.NetworkManager').
Get one from DBus.getService; it follows the name to its current owner when the service restarts.

```typescript
const service = await dbus.getService('org.freedesktop.DBus')
console.log(await service.listObjectPaths())   // ['/', '/org/freedesktop/DBus']
const object = await service.getObject('/org/freedesktop/DBus')
```

#### `readonly name: string`

The service's name as requested, e.g. 'org.freedesktop.NetworkManager'.

#### `readonly uniqueName: string`

The unique name of the connection that currently owns the name, e.g. ':1.42'; updated when the owner changes.

#### `new DBusService(opts: DBusServiceOpts): DBusService`

Created by DBus.getService; not meant to be constructed directly.

- `opts`: The connection, the service name and its current owner.

#### `listObjectPaths(): Promise<string[]>`

Lists the paths of the service's objects by introspecting its tree from '/'. Paths that are only intermediate
nodes without interfaces (e.g. '/org' above '/org/example/Object') are left out; subtrees that fail to
introspect are skipped.

Returns: The object paths, e.g. ['/', '/org/example/Object'].

#### `getObjects(): Promise<DBusObject[]>`

Proxies for all objects listed by listObjectPaths.

Returns: One DBusObject per object path.

#### `getObject(objectPath: string): Promise<DBusObject>`

A proxy for the object at a path. Nothing is checked or sent until the object is used: a path without an
object gives an object without interfaces.

- `objectPath`: The object path, e.g. '/org/freedesktop/DBus'.

Returns: The object proxy.

### class `DBusObject`

A proxy for one object of a service on the bus. Get one from DBus.getObject or DBusService.getObject; its
interfaces are found by introspection.

```typescript
const object = await dbus.getObject('org.freedesktop.DBus', '/org/freedesktop/DBus')
console.log(await object.listInterfaceNames())
const iface = await object.getInterface('org.freedesktop.DBus')
```

#### `readonly name: string`

The object path, e.g. '/org/freedesktop/DBus'.

#### `new DBusObject(opts: DBusObjectOpts): DBusObject`

Created by DBus.getObject and DBusService.getObject; not meant to be constructed directly.

- `opts`: The connection, the service and the object path.

#### `introspect(): Promise<IntrospectNode>`

Introspects the DBus object to retrieve its structure and metadata.
Invokes the Introspect method on the DBus object to get XML data, parses it, and constructs
an IntrospectNode object with details about interfaces, methods, properties, and signals.

Returns: A Promise resolving to an IntrospectNode object representing the object's introspection data.

#### `listInterfaceNames(): Promise<string[]>`

Lists all interface names available on this DBus object.
Performs introspection to retrieve the list of interfaces and optionally caches the result.

Returns: A Promise resolving to an array of interface names as strings.

#### `getInterfaces(): Promise<DBusInterface[]>`

Retrieves all DBus interfaces available on this object.
Uses shared introspection data to efficiently create DBusInterface instances for all interfaces.

Returns: A Promise resolving to an array of DBusInterface instances for all interfaces on this object.

#### `getInterface(iface: string, opts?: ProxyOpts): Promise<DBusInterface>`

A proxy for one of this object's interfaces, built by introspecting the object.

- `iface`: The interface name.
- `opts`: decode: how the proxy gives the values it receives (see DecodeOpts).

Returns: The interface proxy.

Throws: {InterfaceNotFoundError} When the object's introspection data does not list the interface.

### class `DBusInterface`

A proxy for one interface of a remote object, built from its introspection data. Get one from DBus.getInterface or
DBusObject.getInterface. Methods, properties and signals are reached by name, and arguments take their types from
the introspected signatures, so plain JavaScript values are enough.

```typescript
const iface = await dbus.getInterface('org.example.Greeter', '/org/example/Greeter', 'org.example.Greeter1')
const message = await iface.method.Greet('Alice')            // one return value: the value itself
const [count, since] = await iface.method.Stats()            // several: an array
await iface.namedMethod.Greet({name: 'Bob'})                 // arguments by name
iface.noReplyMethod.Ping()                                   // no reply expected
const greeting = await iface.property.Greeting.get()
await iface.property.Greeting.set('Howdy')
iface.signal.on('Greeted', (name, count) => console.log(name, count))
```

#### `readonly name: string`

The interface name, e.g. 'org.freedesktop.DBus.Properties'.

#### `new DBusInterface(opts: DBusInterfaceOpts): DBusInterface`

Created by DBus.getInterface and DBusObject.getInterface; not meant to be constructed directly.

- `opts`: The connection, service, object, interface name and introspection data.

#### `readonly method: Record<string, MethodCall>`

The interface's methods by name, taking the input arguments in order as plain values (their types come from
the introspected signature) and waiting for the reply.

A call resolves with undefined when the method returns nothing, the value itself when it returns one, and an
array when it returns several. It rejects with the error the service replied with, whose `name` is the DBus
error name (e.g. 'org.freedesktop.DBus.Error.InvalidArgs'), or with a TimeoutError after the connection's
callTimeout.

```typescript
const id = await iface.method.GetId()
const [count, since] = await iface.method.Stats()
```

#### `readonly namedMethod: Record<string, NamedMethodCall>`

Like `method`, but each method takes its input arguments as one object keyed by the introspected argument
names, so the order does not matter. Arguments without a name in the introspection data cannot be given.

```typescript
await iface.namedMethod.Divide({dividend: 1, divisor: 4})
```

Throws: {NotEnoughParamsError} (from the call) When an input argument is missing from the object.

#### `readonly noReplyMethod: Record<string, NoReplyMethodCall>`

Like `method`, but each call is sent with NO_REPLY_EXPECTED and returns immediately; its result or error is
never seen. For methods whose outcome does not matter, e.g. notifications.

#### `readonly namedNoReplyMethod: Record<string, NamedNoReplyMethodCall>`

The no-reply form of `namedMethod`: arguments by name, nothing waited for.

#### `readonly property: Record<string, PropertyOperation>`

The interface's properties by name, each with `get()` and `set(value)`, which call
org.freedesktop.DBus.Properties.Get and Set. The value's type comes from the introspected signature.

```typescript
const volume = await iface.property.Volume.get()
await iface.property.Volume.set(50)
```

Throws: {AccessPropertyForbiddenError} (from get/set) When the introspected access mode does not allow it.

#### `readonly signal: DBusSignalEmitter`

Receives this interface's signals from this object: listen with the signal name as the event, and the listener
gets the signal's arguments. Listening adds a match rule on the bus; removing the last listener removes it.
The emitter follows the service to its new owner when it restarts.

```typescript
iface.signal.on('PropertiesChanged', (iface, changed, invalidated) => console.log(changed))
iface.signal.on('*', (signalName, ...args) => console.log(signalName, args))   // every signal
```

#### `listMethods(): IntrospectMethod[]`

The interface's methods as introspected: names, arguments with types and directions, annotations.

#### `listProperties(): IntrospectProperty[]`

The interface's properties as introspected: names, types, access modes, annotations.

#### `listSignals(): IntrospectSignal[]`

The interface's signals as introspected: names, arguments with types, annotations.

### class `DBusSignalEmitter` (extends EventEmitter)

A class that extends Node.js EventEmitter to handle DBus signal emissions.
Manages signal listeners and emitters for a specific DBus service, object path, and interface.
Supports wildcard '*' for unique name, object path, and interface to handle multiple sources.

Each signal name with listeners holds one match rule on the bus: it is added with the first listener and
removed with the last one (including once listeners after they fired).

#### `readonly decode: DecodeOpts | undefined`

How this emitter's listeners get the signals' arguments, if it overrides the connection's DecodeOpts.

#### `readonly service: string`

The service name associated with this emitter.

#### `readonly uniqueName: string`

Getter for the unique name of the DBus connection or wildcard '*'.

Returns: The unique name or '*' if wildcard is used.

#### `readonly objectPath: string`

Getter for the object path or wildcard '*'.

Returns: The object path or '*' if wildcard is used.

#### `readonly interface: string`

Getter for the interface name or wildcard '*'.

Returns: The interface name or '*' if wildcard is used.

#### `new DBusSignalEmitter(opts: CreateSignalEmitterOpts, signalEmitters: Set<DBusSignalEmitter>, onSignalHandler: (service: string | "*", objectPath: string | "*", interfaceName: string | "*", signalName: string | "*") => string | void, offSignalHandler?: (signalRuleString: string) => void): DBusSignalEmitter`

Constructor for DBusSignalEmitter.
Initializes the emitter with options and handlers that add and remove match rules on the bus.

- `opts`: Options for creating the signal emitter, including uniqueName, objectPath, and interface.
- `signalEmitters`: A set of all DBusSignalEmitter instances to manage active emitters.
- `onSignalHandler`: Called to add the match rule for a signal name; returns the rule.
- `offSignalHandler`: Called with a rule returned by onSignalHandler once nothing listens to that signal.

#### `onAny(listener: (signal: ReceivedSignal) => void): this`

Listens to every signal this emitter selects, like on('*', ...), but with where each one came from: the
listener gets a ReceivedSignal with the sender, object path, interface, name and arguments. Useful when the
emitter selects several objects (objectPath '*'), since signal listeners receive only the arguments.

- `listener`: Called with each signal.

```typescript
const properties = bus.createSignalEmitter({service: 'org.example.App', uniqueName: owner, objectPath: '*', interface: 'org.freedesktop.DBus.Properties'})
properties.onAny((signal) => console.log(signal.objectPath, signal.name, signal.args))
```

Returns: This emitter.

#### `offAny(listener: (signal: ReceivedSignal) => void): this`

Removes a listener added with onAny; the match rule goes with the last one.

- `listener`: The listener to remove.

Returns: This emitter.

#### `addListener(eventName: string, listener: (...args: any[]) => void): this`

Adds a listener for the specified event (signal name), subscribing to the signal if needed.

- `eventName`: The name of the event (signal) to listen for.
- `listener`: The callback function to execute when the event is emitted.

Returns: This instance for method chaining.

#### `emit(eventName: string, ...args: any[]): boolean`

Emits an event with the specified name and arguments.

- `eventName`: The name of the event (signal) to emit.
- `args`: The arguments to pass to the event listeners.

Returns: True if the event had listeners, false otherwise.

#### `eventNames(): string[]`

Returns an array of event names for which listeners are registered.

Returns: An array of event names (signal names) as strings.

#### `getMaxListeners(): number`

Gets the maximum number of listeners allowed for any event.

Returns: The maximum number of listeners.

#### `listenerCount(eventName: string, listener?: (...args: any[]) => void): number`

Returns the number of listeners for a specific event, optionally filtered by a specific listener.

- `eventName`: The name of the event (signal) to check.
- `listener`: Optional specific listener to count.

Returns: The number of listeners for the event.

#### `listeners(eventName: string): Function[]`

Returns a copy of the array of listeners for a specific event.

- `eventName`: The name of the event (signal) to get listeners for.

Returns: An array of listener functions.

#### `off(eventName: string, listener: (...args: any[]) => void): this`

Removes a listener for a specific event, unsubscribing from the signal when it was the last one.

- `eventName`: The name of the event (signal) to remove the listener from.
- `listener`: The callback function to remove.

Returns: This instance for method chaining.

#### `on(eventName: string, listener: (...args: any[]) => void): this`

Adds a listener for the specified event (signal name), subscribing to the signal if needed.

- `eventName`: The name of the event (signal) to listen for.
- `listener`: The callback function to execute when the event is emitted.

Returns: This instance for method chaining.

#### `once(eventName: string, listener: (...args: any[]) => void): this`

Adds a one-time listener for the specified event (signal name), subscribing to the signal if needed.
The subscription ends with the listener's removal after it fires, unless other listeners remain.

- `eventName`: The name of the event (signal) to listen for once.
- `listener`: The callback function to execute when the event is emitted.

Returns: This instance for method chaining.

#### `prependListener(eventName: string, listener: (...args: any[]) => void): this`

Prepends a listener for the specified event (signal name), subscribing to the signal if needed.

- `eventName`: The name of the event (signal) to listen for.
- `listener`: The callback function to execute when the event is emitted.

Returns: This instance for method chaining.

#### `prependOnceListener(eventName: string, listener: (...args: any[]) => void): this`

Prepends a one-time listener for the specified event (signal name), subscribing to the signal if needed.

- `eventName`: The name of the event (signal) to listen for once.
- `listener`: The callback function to execute when the event is emitted.

Returns: This instance for method chaining.

#### `rawListeners(eventName: string): Function[]`

Returns a copy of the array of raw listeners for a specific event, including wrappers like once.

- `eventName`: The name of the event (signal) to get raw listeners for.

Returns: An array of raw listener functions.

#### `removeAllListeners(eventName?: string): this`

Removes all listeners for a specific event or all events, unsubscribing from the affected signals.

- `eventName`: Optional name of the event (signal) to remove listeners from.

Returns: This instance for method chaining.

#### `removeListener(eventName: string, listener: (...args: any[]) => void): this`

Removes a specific listener for an event, unsubscribing from the signal when it was the last one.

- `eventName`: The name of the event (signal) to remove the listener from.
- `listener`: The callback function to remove.

Returns: This instance for method chaining.

#### `setMaxListeners(n: number): this`

Sets the maximum number of listeners allowed for any event.

- `n`: The maximum number of listeners.

Returns: This instance for method chaining.

### class `DBusObjectManager` (extends EventEmitter)

A client for a service's org.freedesktop.DBus.ObjectManager: keeps a local copy of the objects it manages, their
interfaces and their properties, and tells you when they change. Get one from DBus.getObjectManager.

The copy is filled with GetManagedObjects and kept up to date with InterfacesAdded, InterfacesRemoved and
PropertiesChanged. When the service leaves the bus its objects are removed; when it comes back they are read
again. Values are plain JavaScript values, as everywhere else.

```typescript
const manager = await bus.getObjectManager('org.bluez')
for (const path of manager.listObjectPaths()) console.log(path, manager.listInterfaceNames(path))
manager.on('objectAdded', (path, interfaces) => console.log('new', path, Object.keys(interfaces)))
manager.on('propertiesChanged', (path, iface, changed) => console.log(path, changed))
const device = await manager.getInterface('/org/bluez/hci0/dev_00_11_22_33_44_55', 'org.bluez.Device1')
await device.method.Connect()
manager.close()
```

#### `readonly service: string`

The well-known name of the service, e.g. 'org.bluez'.

#### `readonly objectPath: string`

Path of the object implementing org.freedesktop.DBus.ObjectManager, e.g. '/'.

#### `new DBusObjectManager(opts: DBusObjectManagerOpts): DBusObjectManager`

Created by DBus.getObjectManager, which also loads the objects; not meant to be constructed directly.

- `opts`: The connection, the service, its current owner, and the path of its object manager.

#### `listObjectPaths(): string[]`

The paths of the managed objects, e.g. ['/org/bluez/hci0'].

Returns: The object paths, in the order the objects appeared.

#### `listInterfaceNames(objectPath: string): string[]`

The interfaces of a managed object.

- `objectPath`: The object's path.

Returns: The interface names; empty when the object is not managed.

#### `getProperties(objectPath: string, interfaceName: string): Record<string, any> | undefined`

The properties of an interface of a managed object, as last reported by the service.

- `objectPath`: The object's path.
- `interfaceName`: The interface name.

Returns: A copy of {property: value}; undefined when the object or interface is not managed.

#### `getManagedObjects(): Record<string, Record<string, Record<string, any>>>`

Everything managed, in the shape GetManagedObjects returns.

Returns: A copy of {object path: {interface: {property: value}}}.

#### `getObject(objectPath: string): Promise<DBusObject>`

A proxy for a managed object, to call its methods; see DBus.getObject.

- `objectPath`: The object's path.

Returns: The object proxy.

#### `getInterface(objectPath: string, interfaceName: string): Promise<DBusInterface>`

A proxy for an interface of a managed object, to call its methods and use its properties; see
DBus.getInterface.

- `objectPath`: The object's path.
- `interfaceName`: The interface name.

Returns: The interface proxy.

Throws: {InterfaceNotFoundError} When the object does not have the interface.

#### `close(): void`

Stops following the service: removes the match rules and listeners. The local copy keeps its last state.

#### `on(eventName, listener)`

Listens to an event of this DBusObjectManager:

| Event | Listener arguments | Emitted when |
|---|---|---|
| `objectAdded` | `(objectPath: string, interfaces: Record<string, Record<string, any>>)` | when an object appears, with its {interface: {property: value}} |
| `objectRemoved` | `(objectPath: string, interfaceNames: string[])` | when an object disappears, with the interfaces it had |
| `interfacesAdded` | `(objectPath: string, interfaces: Record<string, Record<string, any>>)` | when an existing object gains interfaces |
| `interfacesRemoved` | `(objectPath: string, interfaceNames: string[])` | when an object loses some, but not all, of its interfaces |
| `propertiesChanged` | `(objectPath: string, interfaceName: string, changed: Record<string, any>, invalidated: string[])` | when PropertiesChanged arrives for a managed object, after the copy was updated (invalidated properties are removed from it) |
| `error` | `(error: Error)` | when reading the objects again after the service restarted fails |

## Service

Providing a service: its objects, interfaces, methods, properties and signals.

### class `LocalService`

A service you provide on the bus under a well-known name: holds LocalObjects, connects with run(), answers method
calls by routing them to the right object, interface and method, and stops with stop().

The root object '/' exists from the start and carries org.freedesktop.DBus.ObjectManager, which announces objects
added and removed while the service runs. Do not add another object at '/'.

```typescript
const service = new LocalService('org.example.Greeter')
service.addObject(greeterObject)
const result = await service.run()   // the session bus; run({busAddress}) for another
if (result !== RequestNameResultCode.DBUS_REQUEST_NAME_REPLY_PRIMARY_OWNER) console.error('name is taken')
process.once('SIGTERM', () => service.stop({graceful: true, timeout: 5000}))
```

#### `readonly dbus: DBus`

The DBus connection of the running service (set by run).

#### `readonly objectManager: ObjectManagerInterface | undefined`

The service's object manager, at the path given by the objectManagerPath option ('/' by default); undefined
with objectManagerPath null.

#### `readonly name: string`

Getter for the name of this local service.
Returns the validated service name set during construction.

Returns: The service name as a string (e.g., 'org.example.Service').

#### `new LocalService(serviceName: string, opts?: LocalServiceOpts): LocalService`

Creates a service with its root object '/' and, unless objectManagerPath is null, an object manager.

- `serviceName`: The well-known name to request, e.g. 'org.example.Service'.
- `opts`: objectManagerPath: where the object manager is ('/' by default), or null for none.

```typescript
new LocalService('org.example.Greeter')                                         // object manager at '/'
new LocalService('org.example.App', {objectManagerPath: '/org/example/App'})    // manages the objects below it
```

Throws: {LocalServiceInvalidNameError} If the name is not a valid DBus bus name.

Throws: {LocalObjectInvalidNameError} If objectManagerPath is not a valid object path.

#### `run(opts?: RunServiceOpts): Promise<RequestNameResultCode>`

Connects to the bus, starts answering method calls, and requests the service's name.

A taken name does not make it fail: by default the service is queued and gets the name when the owner
releases it (DBUS_REQUEST_NAME_REPLY_IN_QUEUE). Check the result, or pass
`flags: RequestNameFlags.DBUS_NAME_FLAG_DO_NOT_QUEUE` to get DBUS_REQUEST_NAME_REPLY_EXISTS instead.

- `opts`: Where to connect, as for DBus.connect (the session bus by default), and `flags` for requesting the name.

Returns: The result of requesting the name; DBUS_REQUEST_NAME_REPLY_PRIMARY_OWNER when the service owns it.

Throws: {UnknownBusAddressError | CreateStreamFailedError | TimeoutError | AuthError} When connecting fails.

#### `stop(opts?: StopServiceOpts): Promise<void>`

Stops the service and disconnects from the DBus bus.
By default the name is released and the connection closed immediately; calls still being handled cannot be
answered any more. With `graceful`, new method calls are first answered with
org.freedesktop.DBus.Error.ServiceUnknown while the calls being handled finish (for at most `timeout`
milliseconds, if given), and only then is the name released and the connection closed.

- `opts`: Whether to stop gracefully, and how long to wait for calls being handled.

Returns: A Promise that resolves when the service is stopped and disconnected from the bus.

#### `addObject(localObject: LocalObject): boolean`

Adds an object. While the service runs, the object manager announces it with InterfacesAdded.

- `localObject`: The object to add.

Returns: True when it was added, false when this object was already added.

Throws: {LocalObjectPathExistsError} If another object has the same path ('/' always exists).

#### `removeObject`

```typescript
removeObject(localObject: LocalObject): boolean
removeObject(localObjectPath: string): boolean
```

Removes a LocalObject from this service by object path.
Unlinks the object from the service to prevent further operations and notifies the object manager
of the removal if an ObjectManager interface is available on the root object.

- `localObjectPath`: The path of the object to remove.

Returns: A boolean indicating whether the object was successfully removed (true if removed, false if not found).

#### `getObjects(): LocalObject[]`

Lists all objects associated with this service.
Provides a convenient way to inspect all objects currently linked to the service by returning
a record mapping object paths to their respective LocalObject instances.

Returns: A record mapping object paths to their LocalObject instances.

#### `getObject<T extends LocalObject = LocalObject>(objectPath: string): T | undefined`

Finds a LocalObject by its path.
Allows retrieval of a specific object by its object path with type casting for specialized object types.

- `objectPath`: The path of the object to find (e.g., '/org/example/Object').

Returns: The LocalObject instance of the specified type if found, otherwise undefined.

#### `listObjectPaths(): string[]`

Lists all object paths associated with this service.
Provides a quick way to retrieve just the paths of the objects for enumeration purposes.

Returns: An array of object paths as strings.

### class `LocalObject`

An object of a service you provide, at an object path, holding LocalInterfaces. Every object also has the standard
interfaces org.freedesktop.DBus.Properties, .Introspectable and .Peer, answered by the library.

```typescript
const object = new LocalObject('/org/example/Greeter')
object.addInterface(greeterInterface)
service.addObject(object)
```

#### `readonly service: LocalService | undefined`

The LocalService this object was added to, if any.

#### `readonly dbus: DBus | undefined`

Getter for the DBus instance associated with this object's service.
Provides access to the DBus connection for operations like signal emission.

Returns: The DBus instance if the service is defined, otherwise undefined.

#### `readonly name: string`

Getter for the name (object path) of this local object.
Returns the validated object path set during construction.

Returns: The object path as a string (e.g., '/org/example/Object').

#### `readonly propertiesInterface: PropertiesInterface`

Getter for the Properties interface associated with this object.
Provides access to the standard 'org.freedesktop.DBus.Properties' interface
for handling property-related operations across all interfaces on this object.

Returns: The PropertiesInterface instance for handling property-related operations.

#### `readonly introspectableInterface: IntrospectableInterface`

Getter for the Introspectable interface associated with this object.
Provides access to the standard 'org.freedesktop.DBus.Introspectable' interface
for handling introspection operations to describe the object's structure.

Returns: The IntrospectableInterface instance for handling introspection operations.

#### `readonly peerInterface: PeerInterface`

Getter for the Peer interface associated with this object.
Provides access to the standard 'org.freedesktop.DBus.Peer' interface
for handling peer-related operations like ping and machine ID retrieval.

Returns: The PeerInterface instance for handling peer-related operations.

#### `new LocalObject(objectPath: string): LocalObject`

Constructor for LocalObject.
Initializes the object with a validated object path and adds standard DBus interfaces
(Properties, Introspectable, and Peer) for compliance with DBus conventions.

- `objectPath`: The DBus object path to be validated and set (e.g., '/org/example/Object').

Throws: {LocalObjectInvalidNameError} If the provided object path does not meet DBus naming criteria.

#### `readonly introspectNode: IntrospectNode`

Getter for the introspection data of this object.
Provides metadata about all interfaces associated with this object for DBus introspection.

Returns: An IntrospectNode object containing the introspection data for all interfaces associated with this object.

#### `addInterface(localInterface: LocalInterface): boolean`

Adds a LocalInterface to this object.
Associates the interface with this object, linking it to the object's context,
and notifies the service's object manager of the addition if applicable.

- `localInterface`: The LocalInterface instance to add to this object.

Returns: A boolean indicating whether the interface was successfully added (true if added, false if already present).

Throws: {LocalInterfaceExistsError} If an interface with the same name already exists and is not the same instance.

#### `removeInterface`

```typescript
removeInterface(interfaceName: string): boolean
removeInterface(localInterface: LocalInterface): boolean
```

Removes a LocalInterface from this object by instance.
Unlinks the interface from the object and notifies the service's object manager of the removal.

- `localInterface`: The LocalInterface instance to remove.

Returns: A boolean indicating whether the interface was successfully removed (true if removed, false if not found).

#### `getInterfaces(): LocalInterface[]`

Lists all interfaces associated with this object.
Provides a convenient way to inspect all interfaces currently linked to the object.

Returns: A record mapping interface names to their LocalInterface instances.

#### `listInterfaceNames(): string[]`

Lists the names of all interfaces associated with this object.
Provides a quick way to retrieve just the names of the interfaces for enumeration.

Returns: An array of interface names as strings.

#### `getInterface<T extends LocalInterface = LocalInterface>(name: string): T | undefined`

Finds a LocalInterface by its name.
Allows retrieval of a specific interface with type casting for specialized interface types.

- `name`: The name of the interface to find (e.g., 'org.example.MyInterface').

Returns: The LocalInterface instance of the specified type if found, otherwise undefined.

#### `getManagedInterfaces(): Record<string, Record<string, DBusSignedValue>>`

Gets all managed interfaces and their properties as a record.
Retrieves the current properties of all interfaces on this object as DBusSignedValue instances.

Returns: A record mapping interface names to their property records (property name to DBusSignedValue).

### class `LocalInterface`

An interface of a service you provide: its methods, properties and signals, defined with defineMethod,
defineProperty and defineSignal. Add it to a LocalObject, and the object to a LocalService.

```typescript
const iface = new LocalInterface('org.example.Greeter1')
    .defineMethod({name: 'Greet', inputArgs: [{type: 's'}], outputArgs: [{type: 's'}], method: (name: string): string => `Hello, ${name}!`})
    .defineProperty({name: 'Greeting', type: 's', getter: (): string => 'Hello'})
const object = new LocalObject('/org/example/Greeter')
object.addInterface(iface)
const service = new LocalService('org.example.Greeter')
service.addObject(object)
await service.run()
```

#### `readonly object: LocalObject | undefined`

The LocalObject this interface was added to, if any.

#### `readonly dbus: DBus | undefined`

Getter for the DBus instance associated with this interface's object.
Provides access to the DBus connection for operations such as emitting signals or sending messages.

Returns: The DBus instance if the associated object is defined and connected, otherwise undefined.

#### `readonly name: string`

Getter for the name of this interface.
Returns the validated interface name set during construction.

Returns: The interface name as a string (e.g., 'org.example.MyInterface').

#### `new LocalInterface(interfaceName: string): LocalInterface`

Constructor for LocalInterface.
Initializes the interface with a validated name, ensuring it adheres to DBus naming rules
as specified in the DBus protocol documentation.

- `interfaceName`: The name of the interface to be validated and set (e.g., 'org.example.MyInterface').

Throws: {LocalInterfaceInvalidNameError} If the provided name does not meet DBus naming criteria.

#### `readonly introspectInterface: IntrospectInterface`

Getter for the introspection data of this interface.
Provides metadata about the interface's methods, properties, and signals in a format suitable
for DBus introspection, allowing clients to discover the capabilities of this interface.

Returns: An IntrospectInterface object containing the name, methods, properties, and signals defined for this interface.

#### `defineAnnotation(name: string, value: string): this`

Adds an annotation to the interface itself (methods, properties and signals take theirs in their options),
e.g. defineAnnotation('org.freedesktop.DBus.Deprecated', 'true'). Replaces an annotation with the same name.

- `name`: The annotation's name, in the form of an interface name.
- `value`: The annotation's value.

Returns: The instance of this LocalInterface for method chaining.

Throws: {LocalInterfaceInvalidAnnotationError} If the name or value is invalid.

#### `removeAnnotation(name: string): this`

Removes an annotation of the interface itself.

- `name`: The annotation's name.

Returns: The instance of this LocalInterface for method chaining.

#### `defineMethod(opts: DefineMethodOpts): this`

Defines a method. The handler receives the input arguments in order as plain values (see the README's type
mapping), plus the call's context last if `withContext` is set. It may be async. What it returns is sent back
typed by `outputArgs`: with one output argument, return its value (an array for 'as', an object for 'a{sv}');
with several, return an array holding one value per output argument; with none, the return value is ignored.
An error it throws is sent to the caller as a DBus error named after the error's `name` when that is a valid
DBus error name (use createDBusError), and '<service name>.<name>' or '<service name>.Error' otherwise.

- `opts`: Name, input and output arguments with their types, the handler, and optional withContext and annotations.

```typescript
iface.defineMethod({
    name: 'Divide',
    inputArgs: [{name: 'dividend', type: 'd'}, {name: 'divisor', type: 'd'}],
    outputArgs: [{name: 'quotient', type: 'd'}],
    method: (dividend: number, divisor: number): number => {
        if (divisor === 0) throw createDBusError('org.example.Error.DivisionByZero', 'Cannot divide by zero')
        return dividend / divisor
    }
})
```

Returns: This interface, for chaining.

Throws: {LocalInterfaceMethodDefinedError} If a method with the same name is already defined.

Throws: {LocalInterfaceInvalidMethodNameError} If the name is not a valid DBus member name.

#### `removeMethod(name: string): this`

Removes a defined method from this interface.
Deletes the method from the internal record and removes its associated introspection data.

- `name`: The name of the method to remove.

Returns: The instance of this LocalInterface for method chaining.

#### `defineProperty(opts: DefinePropertyOpts): this`

Defines a property. Its access follows the functions given: getter only → read, setter only → write, both →
readwrite. The getter returns a plain value of the property's type; the setter receives one and may be async
or throw, which the caller of Set sees as a DBus error.

With emitPropertiesChanged, a change made through the setter (a DBus Set call, or setProperty from your own
code) sends org.freedesktop.DBus.Properties.PropertiesChanged, with the new value or, with
`{emitValue: false}`, as invalidated. Announce a value changed some other way, e.g. a read-only property updated
by the service, with emitPropertiesChanged(name).

- `opts`: Name, type signature, getter and/or setter, emitPropertiesChanged and annotations.

```typescript
let volume = 50
iface.defineProperty({
    name: 'Volume',
    type: 'u',
    emitPropertiesChanged: true,
    getter: (): number => volume,
    setter: (value: number): void => { volume = Math.min(value, 100) }
})
```

Returns: This interface, for chaining.

Throws: {LocalInterfacePropertyDefinedError} If a property with the same name is already defined.

Throws: {LocalInterfaceInvalidPropertyNameError} If the name is not a valid DBus member name.

#### `emitPropertiesChanged(names: string | string[]): void`

Announces that properties changed, with org.freedesktop.DBus.Properties.PropertiesChanged. Use it for values
that change other than through their setter, e.g. a read-only property updated by the service itself; clients
that cache properties (proxies, object manager clients) rely on it.

Each property is sent with its current value from the getter, typed by its signature, or as invalidated when it
was defined with `emitPropertiesChanged: {emitValue: false}`, has no getter, or its getter throws. Changes
announced in the same turn of the event loop, including those made through setters, go out in one signal.
Nothing is sent while the interface is not on an object of a running service.

- `names`: The name or names of the changed properties.

```typescript
battery = 42
iface.emitPropertiesChanged('Percentage')
iface.emitPropertiesChanged(['State', 'TimeToEmpty'])
```

Throws: {Error} Named 'org.freedesktop.DBus.Error.UnknownProperty' when a property is not defined.

#### `removeProperty(name: string): this`

Removes a defined property from this interface.
Deletes the property from the internal record and removes its associated introspection data.

- `name`: The name of the property to remove.

Returns: The instance of this LocalInterface for method chaining.

#### `defineSignal(opts: DefineSignalOpts): this`

Defines a signal, sent whenever the given EventEmitter emits an event of the signal's name: the event's
arguments become the signal's arguments, typed by `args`. Signals are sent only while the interface is on an
object of a running service.

- `opts`: Name, arguments with their types, the EventEmitter, and annotations.

```typescript
const events = new EventEmitter()
iface.defineSignal({name: 'Greeted', args: [{name: 'name', type: 's'}, {name: 'count', type: 'u'}], eventEmitter: events})
events.emit('Greeted', 'Alice', 1)   // sends the signal
```

Returns: This interface, for chaining.

Throws: {LocalInterfaceSignalDefinedError} If a signal with the same name is already defined.

Throws: {LocalInterfaceInvalidSignalNameError} If the name is not a valid DBus member name.

#### `removeSignal(name: string): this`

Removes a defined signal from this interface.
Deletes the signal from the internal record, removes its listener from the associated event emitter,
and updates the introspection data by removing the signal's metadata.

- `name`: The name of the signal to remove.

Returns: The instance of this LocalInterface for method chaining.

#### `callMethod(name: string, payloadSignature: string | undefined, args?: any[], context?: MethodCallContext): Promise<{ signature?: string; result: any; }>`

Calls a defined method on this interface.
Executes the method implementation with the provided arguments after validating the input signature
to ensure compatibility with the defined method signature.

- `name`: The name of the method to call.
- `payloadSignature`: The signature of the arguments, checked against the method's input signature.
- `args`: The arguments.
- `context`: The call being answered, passed to methods defined with `withContext`; LocalService provides it, and it is undefined when the method is called directly.

Returns: A Promise resolving to an object containing the method's output signature (if defined) and result.

Throws: {Error} Named 'org.freedesktop.DBus.Error.UnknownMethod' or '...InvalidArgs' when the method is not
defined or the signature does not match; otherwise whatever the method throws.

#### `setProperty(name: string, value: any): Promise<void>`

Sets a property through its setter, as a DBus Set call does: the value is checked against the property's type,
the setter is awaited, and PropertiesChanged is sent if the property was defined with emitPropertiesChanged.
Service code can use it to change a writable property and announce the change.

- `name`: The property name.
- `value`: The new value.

Returns: Resolves when the setter has finished.

Throws: {Error} Named 'org.freedesktop.DBus.Error.UnknownProperty', '...InvalidArgs' (the value does not fit the
type) or '...PropertyReadOnly' (no setter); otherwise whatever the setter throws.

#### `getProperty(name: string): any`

The value of a property, from its getter.

- `name`: The property name.

Returns: What the getter returns.

Throws: {Error} Named 'org.freedesktop.DBus.Error.UnknownProperty' or '...PropertyWriteOnly' (no getter).

#### `getPropertySignedValue(name: string): DBusSignedValue`

Gets the value of a defined property as a DBusSignedValue on this interface.
Retrieves the property value using getProperty and parses it into a DBusSignedValue with the correct signature,
ensuring it is suitable for DBus operations like method replies or signal data.

- `name`: The name of the property to get.

Returns: A DBusSignedValue instance representing the property value with its associated signature.

Throws: {Error} Named 'org.freedesktop.DBus.Error.UnknownProperty' or '...PropertyWriteOnly'.

#### `getManagedProperties(): Record<string, DBusSignedValue>`

Gets all readable properties as a record of DBusSignedValue objects, as GetAll and the object manager report
them. Write-only properties, and properties that cannot be read now (the getter throws or returns a value that
does not fit the type), are left out.

Returns: A record mapping property names to their corresponding DBusSignedValue instances.

#### `listMethodNames(): string[]`

Lists the names of all defined methods on this interface.
Provides a convenient way to inspect the available methods for introspection or debugging purposes.

Returns: An array of method names as strings.

#### `listPropertyNames(): string[]`

Lists the names of all defined properties on this interface.
Provides a convenient way to inspect the available properties for introspection or debugging purposes.

Returns: An array of property names as strings.

#### `listSignalNames(): string[]`

Lists the names of all defined signals on this interface.
Provides a convenient way to inspect the available signals for introspection or debugging purposes.

Returns: An array of signal names as strings.

### `createDBusError(DBusErrorName: string, message: string): Error`

Creates a DBus-specific Error object with a custom error name and message.
This function is used to generate errors related to DBus operations with identifiable error names.

- `DBusErrorName`: The name of the DBus error (e.g., 'org.freedesktop.DBus.Error.Failed'). This identifies the specific type of DBus error.
- `message`: A descriptive message explaining the cause of the error.

Returns: An Error object with the specified name and message, representing a DBus error.

### class `PropertiesInterface` (extends LocalInterface)

A class representing the DBus Properties interface.
This interface provides methods to get, set, and monitor properties of other interfaces
on a DBus object. Implements the 'org.freedesktop.DBus.Properties' interface as per
the DBus specification for standardized property management.

#### `new PropertiesInterface(): PropertiesInterface`

Constructor for the PropertiesInterface.
Initializes the interface with the name 'org.freedesktop.DBus.Properties'
and defines methods for getting and setting properties ('Get', 'GetAll', 'Set'),
as well as a signal ('PropertiesChanged') for notifying about property changes.

### class `IntrospectableInterface` (extends LocalInterface)

A class representing the DBus Introspectable interface.
This interface provides introspection capabilities for DBus objects, allowing clients to query
the structure (methods, properties, signals) of a DBus object as XML data.
Implements the 'org.freedesktop.DBus.Introspectable' interface.

#### `new IntrospectableInterface(): IntrospectableInterface`

Constructor for the IntrospectableInterface.
Initializes the interface with the name 'org.freedesktop.DBus.Introspectable'
and defines the 'Introspect' method to return XML introspection data.

#### `getIntrospectXML(path?: string, inputObjectPaths?: string[]): string`

Generates the full introspection XML for a given object path.
Combines the DOCTYPE header with the formatted XML content for the specified path.

- `path`: Optional object path to generate introspection XML for.
- `inputObjectPaths`: Optional list of object paths to consider for introspection.

Returns: The complete introspection XML string, including the DOCTYPE header.

#### `formatIntrospectXML(path?: string, inputObjectPaths?: string[]): string`

Formats the introspection data into XML for a given object path.
Builds an XML representation of the DBus object's structure, including interfaces,
methods, properties, signals, and sub-nodes, using the xml2js Builder.

- `path`: Optional object path to format introspection XML for.
- `inputObjectPaths`: Optional list of object paths to consider for introspection.

Returns: The formatted introspection XML string (without DOCTYPE header).

### class `PeerInterface` (extends LocalInterface)

A class representing the DBus Peer interface.
This interface provides basic peer-to-peer functionality for DBus connections,
including retrieving the machine ID and a simple ping method for testing connectivity.
Implements the 'org.freedesktop.DBus.Peer' interface.

#### `new PeerInterface(): PeerInterface`

Constructor for the PeerInterface.
Initializes the interface with the name 'org.freedesktop.DBus.Peer'
and defines two methods: 'GetMachineId' to retrieve the machine UUID,
and 'Ping' for connectivity testing.

### class `ObjectManagerInterface` (extends LocalInterface)

org.freedesktop.DBus.ObjectManager for a LocalService: GetManagedObjects lists the objects below this interface's
object with their interfaces and properties, and InterfacesAdded / InterfacesRemoved announce objects and
interfaces as they are added and removed.

A LocalService has one on '/' by default (see LocalServiceOpts.objectManagerPath). Adding one to another object
nests a manager: each object is reported by the nearest manager above it.

```typescript
const sub = new LocalObject('/org/example/Sub')
sub.addInterface(new ObjectManagerInterface())   // reports the objects below /org/example/Sub
service.addObject(sub)
```

#### `new ObjectManagerInterface(): ObjectManagerInterface`

Constructor for the ObjectManagerInterface.
Initializes the interface with the name 'org.freedesktop.DBus.ObjectManager'
and defines the 'GetManagedObjects' method to retrieve all managed objects,
as well as 'InterfacesAdded' and 'InterfacesRemoved' signals to notify about changes.

## Values and signatures

Typed values, signatures, and the enums used by the API.

### class `DBusSignedValue`

A value with an explicit DBus type: use it wherever a value is sent to give it a type other than the one it would
get otherwise, typically inside variants (`v`) and `a{sv}` dictionaries. Containers may hold plain values, which
take their types from the signature, and typed values, which keep theirs. The type classes (DBusUInt32,
DBusObjectPath, DBusArray, …) are DBusSignedValue too.

Received values come back as type class instances where DecodeOpts.types asks for them.

```typescript
new DBusSignedValue('u', 7)                                            // the same as new DBusUInt32(7)
new DBusSignedValue('a{sv}', {mtu: new DBusUInt32(1500), name: 'eth0'})
new DBusSignedValue('as', [])                                          // an empty array of strings
new DBusSignedValue('(uu)', [1, 2])
```

#### `readonly signature: string`

The complete signature of this value, e.g. 'u', 'as' or 'a{sv}'.

#### `readonly value: any`

This value as a plain JavaScript value, the way it is decoded by default: numbers, bigints for 64-bit
integers, strings, booleans, Buffers for byte arrays, arrays, and objects for dictionaries.

#### `DBusSignedValue.toPlain(values: DBusSignedValue[]): any[]`

Static method to convert an array of DBusSignedValue objects back to plain JavaScript objects.
Recursively processes nested structures (arrays, structs, dictionaries) and removes DBus
signature metadata to return raw values suitable for general use.

- `values`: An array of DBusSignedValue objects to convert.

Returns: An array of plain JavaScript values representing the data without DBus signatures.

#### `new DBusSignedValue(signature: string, value: any): DBusSignedValue`

Gives a value a DBus type.

- `signature`: The complete signature of one type, e.g. 'u', 'as', 'a{sv}' or '(si)'.
- `value`: The value: plain values take their types from the signature, DBusSignedValue values (and type class instances) inside containers keep theirs. A variant ('v') holds a typed value, or a plain one whose type is inferred (see inferSignature).

Throws: {SignatureError} If the signature is invalid or the value's shape does not match it (e.g. a string for
an array). Values out of range for their type are rejected when encoded.

#### `DBusSignedValue.inferSignature(value: any): string`

The signature a plain value given for a variant ('v') is sent with:
- string → 's', boolean → 'b', bigint → 'x'
- number → 'i' for an integer within INT32, 'x' for a larger safe integer, 'd' otherwise
- Buffer / Uint8Array → 'ay'; other typed arrays → the matching integer array ('an', 'aq', 'ax', 'at')
- array → 'a' + the items' type when they share one (numbers widen together, e.g. [1, 1.5] → 'ad'),
  otherwise a struct of the items' types, e.g. [1, 'a'] → '(is)'; an empty array → 'ai'
- a Map → 'a{' + its keys' type + 'v}', e.g. 'a{iv}' for integer keys
- any other object → 'a{sv}', each property value being inferred in turn (a Date, Set or similar is rejected)
A value already wrapped in a DBusSignedValue keeps its signature.

- `value`: The plain value.

```typescript
DBusSignedValue.inferSignature({name: 'disk', size: 2 ** 40})   // 'a{sv}' (size is sent as 'x')
DBusSignedValue.inferSignature([{id: 1}, {id: 2}])              // 'aa{sv}'
DBusSignedValue.inferSignature([1, 'one'])                       // '(is)'
```

Returns: The complete signature, e.g. 'as' or '(is)'.

Throws: {InvalidValueError} For null, undefined, functions and symbols, which have no DBus type.

### class `Signature`

Class for handling DBus signature parsing and compatibility checking.
Provides static methods to parse signature strings into data type trees and compare signatures for compatibility.

#### `Signature.parse(signature: string): DataType[]`

Parses a DBus signature string into an array of data type structures.
Converts a signature string (e.g., 'a{sv}') into a tree-like structure of DataType objects.
Throws a SignatureError if the signature is invalid or contains unknown types.

- `signature`: The DBus signature string to parse (e.g., 'a{sv}' for an array of dictionary entries).

Returns: An array of DataType objects representing the parsed signature structure.

Throws: {SignatureError} If the signature is invalid or contains unrecognized types.

#### `Signature.areCompatible(baseSignature: string | undefined, inputSignature: string | undefined): boolean`

Compare two signature strings to check if they are compatible.
The base signature is the reference (e.g., method definition), and the input signature is the one to compare (e.g., method call).
If the base signature contains 'v' (variant), any type in the input signature at that position is considered compatible.
This rule applies recursively to nested structures.
Returns false instead of throwing an error if signatures are incompatible.
Handles cases where signatures are undefined or empty.

- `baseSignature`: The base signature string (reference, e.g., method definition "vs"). Can be undefined.
- `inputSignature`: The input signature string to compare (e.g., method call "a{sv}s"). Can be undefined.

Returns: True if the signatures are compatible, false if they are not or if inputs are invalid.

Throws: {SignatureError} If either signature is invalid (non-empty and cannot be parsed).

#### `Signature.stringify(dataType: DataType): string`

Converts a parsed type back into its signature string, e.g. {type: 'a', child: [{type: 's'}]} into 'as'.

- `dataType`: A type whose containers list their child types, as returned by Signature.parse.

Returns: The signature of the type.

### enum `RequestNameFlags`

Flags for DBus.requestName and LocalService.run({flags}); they combine with |.

| Member | Value | Meaning |
|---|---|---|
| `DBUS_NAME_FLAG_DEFAULT` | `0` | No flag: queue for the name if it is taken, and do not let others take it over. |
| `DBUS_NAME_FLAG_ALLOW_REPLACEMENT` | `1` | Let another connection take the name over with DBUS_NAME_FLAG_REPLACE_EXISTING. |
| `DBUS_NAME_FLAG_REPLACE_EXISTING` | `2` | Take the name over if its owner allowed replacement. |
| `DBUS_NAME_FLAG_DO_NOT_QUEUE` | `4` | Fail (DBUS_REQUEST_NAME_REPLY_EXISTS) instead of queueing when the name is taken. |

### enum `RequestNameResultCode`

Result of requesting a name (DBus.requestName, LocalService.run).

| Member | Value | Meaning |
|---|---|---|
| `DBUS_REQUEST_NAME_REPLY_PRIMARY_OWNER` | `1` | This connection now owns the name; method calls to it arrive here. |
| `DBUS_REQUEST_NAME_REPLY_IN_QUEUE` | `2` | The name is taken; this connection is queued and gets it when the owner releases it. |
| `DBUS_REQUEST_NAME_REPLY_EXISTS` | `3` | The name is taken and this connection was not queued (DBUS_NAME_FLAG_DO_NOT_QUEUE). |
| `DBUS_REQUEST_NAME_REPLY_ALREADY_OWNER` | `4` | This connection already owned the name. |

### enum `DBusPropertyAccess`

Access mode of a property, as published in introspection data.

| Member | Value | Meaning |
|---|---|---|
| `READ` | `"read"` | The property can be read. |
| `WRITE` | `"write"` | The property can be written. |
| `READWRITE` | `"readwrite"` | The property can be read and written. |

### enum `DBusMessageType`

The type of a message, the second byte of its header.

| Member | Value | Meaning |
|---|---|---|
| `METHOD_CALL` | `1` | A method call. |
| `METHOD_RETURN` | `2` | A successful reply to a method call. |
| `ERROR` | `3` | An error reply to a method call. |
| `SIGNAL` | `4` | A signal. |

### enum `DBusMessageFlags`

Flags of a message, the third byte of its header; they combine with |.

| Member | Value | Meaning |
|---|---|---|
| `REPLY_EXPECTED` | `0` | No flag: the sender of a method call expects a reply. |
| `NO_REPLY_EXPECTED` | `1` | The sender does not want a reply to this method call. |
| `NO_AUTO_START` | `2` | The bus must not start (activate) the destination service to deliver this message. |
| `ALLOW_INTERACTIVE_AUTH` | `4` | The caller is prepared to wait for interactive authorization, e.g. a polkit password prompt. |

### enum `DBusMessageEndianness`

Byte order of a message, the first byte of its header: 'l' (108) for little-endian, 'B' (66) for big-endian.
The library writes little-endian and reads both.

| Member | Value | Meaning |
|---|---|---|
| `LE` | `108` | Little-endian ('l'). |
| `BE` | `66` | Big-endian ('B'). |

## Type classes

One class per DBus type, to give a value an explicit type, e.g. inside a variant.

### class `DBusArray` (extends DBusTypeClass)

A DBus ARRAY ('a') built from typed values, all of the same type. For plain values give the signature instead:
new DBusSignedValue('au', [1, 2]).

```typescript
new DBusArray([new DBusUInt32(1), new DBusUInt32(2)])   // 'au'
new DBusArray([], DBusString)                           // an empty 'as'
new DBusArray([], 'a{sv}')                              // an empty 'aa{sv}'
```

#### `DBusArray.type: string`

The DBus type code, 'a'.

#### `readonly items: T[]`

The elements, as typed values (type class instances when decoded with DecodeOpts.types 'variants' or 'all').

#### `new DBusArray<T extends DBusSignedValue = DBusSignedValue>(items: T[], elementType?: string | { type: string; }): DBusArray<T>`

- `items`: The elements: typed values (DBusSignedValue or type class instances), all of the same type.
- `elementType`: The element type of an empty array, as a basic type class (e.g. DBusString) or a complete signature (e.g. 'a{sv}'); by default variant ('av'). Ignored when there are items.

Throws: {InvalidValueError} When an item is a plain value.

Throws: {SignatureError} When the items are of different types, or elementType is not one complete type.

### class `DBusBoolean` (extends DBusTypeClass)

A DBus BOOLEAN ('b'): a boolean.
Use it to give a value this type explicitly; a plain boolean is inferred as 'b' anyway.

```typescript
await iface.method.SetValue(new DBusBoolean(true)) // a 'v' argument holding a 'b'
```

#### `DBusBoolean.type: string`

The DBus type code, 'b'.

#### `new DBusBoolean(value: boolean): DBusBoolean`

- `value`: The value, a boolean, checked against the type when it is encoded.

### class `DBusByte` (extends DBusTypeClass)

A DBus BYTE ('y'): an unsigned 8-bit integer, 0 to 255.
Use it to give a value this type explicitly, e.g. inside a variant, where a plain number would get the inferred type.

```typescript
await iface.method.SetValue(new DBusByte(255)) // a 'v' argument holding a 'y'
```

#### `DBusByte.type: string`

The DBus type code, 'y'.

#### `new DBusByte(value: number): DBusByte`

- `value`: The value, a number, checked against the type when it is encoded.

### class `DBusDictEntry` (extends DBusTypeClass)

A DBus DICT_ENTRY ('{..}'): one key/value pair, built from typed values; a dictionary is a DBusArray of them. For
plain values give the dictionary's signature instead: new DBusSignedValue('a{su}', {count: 7}).

```typescript
new DBusArray([new DBusDictEntry([new DBusString('count'), new DBusUInt32(7)])])   // 'a{su}'
```

#### `DBusDictEntry.type: string`

The DBus type code, '{'.

#### `readonly key: T`

The key, as a typed value.

#### `readonly content: T`

The value of the entry, as a typed value (`value` gives the whole entry as a plain value).

#### `new DBusDictEntry<T extends DBusSignedValue = DBusSignedValue>(value: [T, T]): DBusDictEntry<T>`

- `value`: The key, a typed value of a basic type (e.g. DBusString), and the value, any typed value.

Throws: {InvalidValueError} When the key or the value is a plain value.

Throws: {SignatureError} When the key is not of a basic type.

### class `DBusDouble` (extends DBusTypeClass)

A DBus DOUBLE ('d'): an IEEE 754 double.
Use it to give a value this type explicitly, e.g. inside a variant, where a plain number would get the inferred type.

```typescript
await iface.method.SetValue(new DBusDouble(0.5)) // a 'v' argument holding a 'd'
```

#### `DBusDouble.type: string`

The DBus type code, 'd'.

#### `new DBusDouble(value: number): DBusDouble`

- `value`: The value, a number, checked against the type when it is encoded.

### class `DBusInt16` (extends DBusTypeClass)

A DBus INT16 ('n'): a signed 16-bit integer.
Use it to give a value this type explicitly, e.g. inside a variant, where a plain number would get the inferred type.

```typescript
await iface.method.SetValue(new DBusInt16(-1)) // a 'v' argument holding a 'n'
```

#### `DBusInt16.type: string`

The DBus type code, 'n'.

#### `new DBusInt16(value: number): DBusInt16`

- `value`: The value, a number, checked against the type when it is encoded.

### class `DBusInt32` (extends DBusTypeClass)

A DBus INT32 ('i'): a signed 32-bit integer.
Use it to give a value this type explicitly, e.g. inside a variant, where a plain number would get the inferred type.

```typescript
await iface.method.SetValue(new DBusInt32(-1)) // a 'v' argument holding a 'i'
```

#### `DBusInt32.type: string`

The DBus type code, 'i'.

#### `new DBusInt32(value: number): DBusInt32`

- `value`: The value, a number, checked against the type when it is encoded.

### class `DBusInt64` (extends DBusTypeClass)

A DBus INT64 ('x'): a signed 64-bit integer.
Use it to give a value this type explicitly, e.g. inside a variant, where a plain bigint would get the inferred type.

```typescript
await iface.method.SetValue(new DBusInt64(-1n)) // a 'v' argument holding a 'x'
```

#### `DBusInt64.type: string`

The DBus type code, 'x'.

#### `new DBusInt64(value: bigint): DBusInt64`

- `value`: The value, a bigint, checked against the type when it is encoded.

### class `DBusObjectPath` (extends DBusTypeClass)

A DBus OBJECT_PATH ('o'): an object path.
Use it to give a value this type explicitly, e.g. inside a variant, where a plain string would get the inferred type.

```typescript
await iface.method.SetValue(new DBusObjectPath('/org/example/Object')) // a 'v' argument holding a 'o'
```

#### `DBusObjectPath.type: string`

The DBus type code, 'o'.

#### `new DBusObjectPath(value: string): DBusObjectPath`

- `value`: The value, a string, checked against the type when it is encoded.

### class `DBusSignature` (extends DBusTypeClass)

A DBus SIGNATURE ('g'): a type signature.
Use it to give a value this type explicitly, e.g. inside a variant, where a plain string would get the inferred type.

```typescript
await iface.method.SetValue(new DBusSignature('a{sv}')) // a 'v' argument holding a 'g'
```

#### `DBusSignature.type: string`

The DBus type code, 'g'.

#### `new DBusSignature(value: string): DBusSignature`

- `value`: The value, a string, checked against the type when it is encoded.

### class `DBusString` (extends DBusTypeClass)

A DBus STRING ('s'): a UTF-8 string without NUL characters.
Use it to give a value this type explicitly, e.g. inside a variant, where a plain string would get the inferred type.

```typescript
await iface.method.SetValue(new DBusString('text')) // a 'v' argument holding a 's'
```

#### `DBusString.type: string`

The DBus type code, 's'.

#### `new DBusString(value: string): DBusString`

- `value`: The value, a string, checked against the type when it is encoded.

### class `DBusStruct` (extends DBusTypeClass)

A DBus STRUCT ('(...)') built from typed values, one per field. For plain values give the signature instead:
new DBusSignedValue('(si)', ['answer', 42]).

```typescript
new DBusStruct([new DBusString('answer'), new DBusInt32(42)])   // '(si)'
```

#### `DBusStruct.type: string`

The DBus type code, '('.

#### `readonly fields: T[]`

The fields in order, as typed values (type class instances when decoded with DecodeOpts.types 'variants' or
'all').

#### `new DBusStruct<T extends DBusSignedValue = DBusSignedValue>(value: T[]): DBusStruct<T>`

- `value`: The fields in order: typed values (DBusSignedValue or type class instances), at least one.

Throws: {InvalidValueError} When a field is a plain value.

Throws: {SignatureError} When there are no fields: DBus has no empty structs.

### class `DBusUInt16` (extends DBusTypeClass)

A DBus UINT16 ('q'): an unsigned 16-bit integer.
Use it to give a value this type explicitly, e.g. inside a variant, where a plain number would get the inferred type.

```typescript
await iface.method.SetValue(new DBusUInt16(1)) // a 'v' argument holding a 'q'
```

#### `DBusUInt16.type: string`

The DBus type code, 'q'.

#### `new DBusUInt16(value: number): DBusUInt16`

- `value`: The value, a number, checked against the type when it is encoded.

### class `DBusUInt32` (extends DBusTypeClass)

A DBus UINT32 ('u'): an unsigned 32-bit integer.
Use it to give a value this type explicitly, e.g. inside a variant, where a plain number would get the inferred type.

```typescript
await iface.method.SetValue(new DBusUInt32(7)) // a 'v' argument holding a 'u'
```

#### `DBusUInt32.type: string`

The DBus type code, 'u'.

#### `new DBusUInt32(value: number): DBusUInt32`

- `value`: The value, a number, checked against the type when it is encoded.

### class `DBusUInt64` (extends DBusTypeClass)

A DBus UINT64 ('t'): an unsigned 64-bit integer.
Use it to give a value this type explicitly, e.g. inside a variant, where a plain bigint would get the inferred type.

```typescript
await iface.method.SetValue(new DBusUInt64(2n ** 63n)) // a 'v' argument holding a 't'
```

#### `DBusUInt64.type: string`

The DBus type code, 't'.

#### `new DBusUInt64(value: bigint): DBusUInt64`

- `value`: The value, a bigint, checked against the type when it is encoded.

### class `DBusUnixFD` (extends DBusTypeClass)

A DBus UNIX_FD ('h'): the index of a file descriptor passed along with the message.
Node.js sockets cannot pass file descriptors, so a message containing one is rejected with an error.

#### `DBusUnixFD.type: string`

The DBus type code, 'h'.

#### `new DBusUnixFD(value: number): DBusUnixFD`

- `value`: The file descriptor index.

### class `DBusVariant` (extends DBusTypeClass)

A DBus VARIANT ('v'): a value that carries its own type. A typed value placed where a variant is expected already
becomes the variant's content, so this class is needed only to put a variant inside a variant, or to state it.

```typescript
new DBusVariant(new DBusUInt32(7))   // a variant holding a 'u'
new DBusVariant('text')              // a variant holding an 's', inferred
```

#### `DBusVariant.type: string`

The DBus type code, 'v'.

#### `readonly content: DBusSignedValue`

The content, as a typed value whose `signature` is the variant's inner type (a type class instance when decoded
with DecodeOpts.types 'variants' or 'all').

#### `new DBusVariant<T = any>(value: T): DBusVariant<T>`

- `value`: The content: a typed value, or a plain value whose type is inferred (see DBusSignedValue.inferSignature).

Throws: {InvalidValueError} When the type of a plain value cannot be inferred (null, undefined, …).

## Errors

Errors thrown by the library. Errors replied by the other side of a call are plain `Error`s whose `name` is the DBus error name.

Every class sets `name` to its class name and has a stable `code` and `errno`.

| Class | code | errno | Thrown when |
|---|---|---|---|
| `AccessPropertyForbiddenError` | `E_ACCESS_PROPERTY_FORBIDDEN` | 1016 | A property was read or written through DBusInterface.property against its introspected access mode, e.g. set() on a read-only property. |
| `AlignmentError` | `E_ALIGNMENT` | 1010 | Received data ends inside the padding a value is aligned with; the message is truncated or malformed. |
| `AuthError` | `E_AUTH` | 1006 | Authentication with the bus failed: the server rejected every mechanism tried, or an unsupported one was asked for. |
| `CreateStreamFailedError` | `E_CREATE_STREAM` | 1004 | None of the addresses in a bus address list could be connected to. |
| `InterfaceNotFoundError` | `E_INTERFACE_NOT_FOUND` | 1015 | The remote object's introspection data does not list the requested interface. |
| `InvalidValueError` | `E_INVALID_VALUE` | 1012 | A value does not fit its DBus type (an integer out of range, a string with NUL, a non-boolean for 'b', no type can be inferred for a variant), or received data breaks the specification (invalid UTF-8, non-zero padding, an array over 64 MiB). |
| `LocalInterfaceExistsError` | `E_LOCAL_INTERFACE_EXISTS` | 1018 | LocalObject.addInterface was given an interface whose name the object already has. |
| `LocalInterfaceInvalidAnnotationError` | `E_INVALID_LOCAL_INTERFACE_ANNOTATION` | 1029 | An annotation name does not have the form of an interface name, or its value is not a string. |
| `LocalInterfaceInvalidMethodNameError` | `E_INVALID_LOCAL_INTERFACE_METHOD_NAME` | 1025 | A method name is not a valid member name ([A-Za-z_][A-Za-z0-9_]*, at most 255 bytes). |
| `LocalInterfaceInvalidNameError` | `E_INVALID_LOCAL_INTERFACE_NAME` | 1024 | A LocalInterface name is not a valid interface name, e.g. 'org.example.Interface1'. |
| `LocalInterfaceInvalidPropertyNameError` | `E_INVALID_LOCAL_INTERFACE_PROPERTY_NAME` | 1026 | A property name is not a valid member name ([A-Za-z_][A-Za-z0-9_]*, at most 255 bytes). |
| `LocalInterfaceInvalidSignalNameError` | `E_INVALID_LOCAL_INTERFACE_SIGNAL_NAME` | 1027 | A signal name is not a valid member name ([A-Za-z_][A-Za-z0-9_]*, at most 255 bytes). |
| `LocalInterfaceMethodDefinedError` | `E_LOCAL_INTERFACE_METHOD_DEFINED` | 1019 | LocalInterface.defineMethod was given a name the interface already defines. |
| `LocalInterfacePropertyDefinedError` | `E_LOCAL_INTERFACE_PROPERTY_DEFINED` | 1020 | LocalInterface.defineProperty was given a name the interface already defines. |
| `LocalInterfaceSignalDefinedError` | `E_LOCAL_INTERFACE_SIGNAL_DEFINED` | 1021 | LocalInterface.defineSignal was given a name the interface already defines. |
| `LocalObjectInvalidNameError` | `E_INVALID_LOCAL_OBJECT_NAME` | 1023 | A LocalObject path is not a valid object path, e.g. '/org/example/Object'. |
| `LocalObjectPathExistsError` | `E_LOCAL_OBJECT_EXISTS` | 1017 | LocalService.addObject was given an object whose path the service already has. Every service has '/'. |
| `LocalServiceInvalidNameError` | `E_INVALID_LOCAL_SERVICE_NAME` | 1022 | A LocalService name is not a valid bus name, e.g. 'org.example.Service'. |
| `MessageDecodeError` | `E_MESSAGE_DECODE` | 1028 | A received message could not be decoded. Emitted as 'connectionError' on the DBus instance; when the message was a reply, the call it answers is rejected with it; when it was a method call, the caller gets an org.freedesktop.DBus.Error.InvalidArgs reply. |
| `NotEnoughParamsError` | `E_NOT_ENOUGH_PARAMS` | 1003 | A named-argument call (DBusInterface.namedMethod) lacks one of the method's input arguments, or a unix: bus address has neither path= nor socket=. |
| `ObjectPathError` | `E_OBJECT_PATH` | 1009 | A value for type 'o' is not a valid object path. |
| `ReadBufferError` | `E_READ_BUFFER` | 1011 | Received data ends before a value it announces; the message is truncated or malformed. |
| `SerialError` | `E_SERIAL` | 1008 | A message was written without a serial number. |
| `ServiceNotFoundError` | `E_SERVICE_NOT_FOUND` | 1013 | DBus.getService (and getObject/getInterface through it) was asked for a name that is neither owned on the bus nor activatable, or whose activation did not give it an owner. |
| `SignatureError` | `E_SIGNATURE` | 1007 | A signature is invalid (see the structural rules in the DBus specification), or values do not match it, e.g. two values for a one-type signature. |
| `TimeoutError` | `E_TIMEOUT` | 1000 | A method call got no reply within its timeout (InvokeOpts.timeout or the connection's callTimeout), or connecting to the bus took longer than the connect options' timeout. |
| `UnknownBusAddressError` | `E_UNKNOWN_BUS_ADDR` | 1001 | DBus.connect was given no address and the DBUS_SESSION_BUS_ADDRESS environment variable is not set. |
| `UnknownBusTypeError` | `E_UNKNOWN_BUS_TYPE` | 1002 | A bus address uses a transport other than unix: and tcp:. |
| `UserPermissionError` | `E_PERM` | 1005 | DBUS_COOKIE_SHA1 authentication refused the keyring: ~/.dbus-keyrings is writable by others or owned by another user, or holds no matching cookie. |

## Low level

The connection, messages and the wire format encoder and decoder. Not needed for ordinary use.

### class `DBusConnection` (extends EventEmitter)

A class representing a low-level DBus connection.
Handles the creation of streams (TCP, Unix socket, etc.), authentication handshake,
and message reading/writing over the connection. Extends EventEmitter to emit events
for messages, connection closure, and errors.

#### `DBusConnection.createConnection(opts?: CreateConnectOpts): Promise<DBusConnection>`

Static method to create a DBus connection.
Establishes a stream based on provided or default options, performs the handshake to authenticate,
and returns a fully initialized DBusConnection instance.

- `opts`: Optional connection and handshake options, including stream, bus address, or auth methods.

Returns: A Promise resolving to a DBusConnection instance ready for communication.

#### `readonly authMethod: string`

Getter for the authentication method used in this connection.

Returns: The authentication method (e.g., 'EXTERNAL', 'DBUS_COOKIE_SHA1', 'ANONYMOUS') as a string.

#### `readonly uid: number`

Getter for the user ID used during authentication.

Returns: The user ID as a number.

#### `readonly guid: string`

Getter for the server-provided GUID.

Returns: The GUID as a string, identifying this connection on the server.

#### `readonly connected: boolean`

Checks if the connection is currently active.
Determines the connection status by checking if the stream is not closed.

Returns: True if the stream is not closed (connection is active), false otherwise.

#### `new DBusConnection(stream: Duplex, authMethod: string, uid: string, guid: string, decode?: DecodeOpts): DBusConnection`

Constructor for DBusConnection.
Initializes the connection with the provided stream and authentication details,
sets up event listeners for reading messages, and handles connection closure and errors.
Implements a state machine to parse incoming DBus messages by reading headers and bodies.

- `stream`: The duplex stream for communication with the DBus server.
- `authMethod`: The authentication method that succeeded during handshake.
- `uid`: The user ID used during authentication, as a string (later parsed to number).
- `guid`: The GUID provided by the server after successful authentication.
- `decode`: How received values are given by default (see DecodeOpts); each message's body uses it.

#### `write(data: Buffer): boolean`

Writes data to the DBus connection stream.
Used to send encoded DBus messages to the server.

- `data`: The Buffer containing the data to write to the stream.

Returns: True if the write operation was successful, false otherwise (e.g., if the stream is not writable).

#### `end(callback?: () => void): this`

Closes the DBus connection stream.
Ends the connection, optionally executing a callback when the stream is fully closed.

- `callback`: Optional callback function to execute when the stream is closed.

Returns: This instance for method chaining.

#### `on(eventName, listener)`

Listens to an event of this DBusConnection:

| Event | Listener arguments | Emitted when |
|---|---|---|
| `message` | `(message: DBusMessage)` | when a complete message has been received and decoded |
| `close` | `()` | when the DBus connection is closed |
| `error` | `(error: Error)` | when an error occurs on the DBus connection |

#### `once(eventName, listener)`

The same events as `on`.

### class `DBusMessage`

A class representing a DBus message.
Handles the creation, encoding, and decoding of DBus messages, including headers and bodies.
Supports various message types such as method calls, replies, signals, and errors.
This class is central to DBus communication, providing the means to construct and parse messages
according to the DBus wire protocol.

#### `readonly endianness: DBusMessageEndianness`

The endianness used for encoding and decoding DBus messages.
Defaults to little-endian (LE) as it is the most common in DBus implementations.
Determines the byte order for multi-byte values in the message.

#### `readonly header: DBusMessageHeader`

The header of the DBus message.
Contains metadata such as message type, flags, serial number, and other fields like path and interface.
This is essential for routing and processing the message on the DBus.

#### `readonly body: any[]`

The arguments of the message. For a message to send, the values it was created with; for a received
message, its values decoded with the connection's DecodeOpts (plain values by default). getBody gives them
with other choices.

#### `getBody(decode?: DecodeOpts): any[]`

The arguments of a received message, decoded with the given choices; those not given are the connection's.
For a message to send, the values it was created with.

- `decode`: How to give the values (see DecodeOpts).

```typescript
dbus.on('methodCall', (message) => console.log(message.getBody({types: 'all'})))
```

Returns: The arguments.

#### `new DBusMessage(header: DBusMessageHeader | Partial<DBusMessageHeader>, ...body: any[]): DBusMessage`

Constructor for creating a DBusMessage instance.
Initializes the message with a header and optional body content, applying default values for required fields.
Defaults ensure that a message is always in a valid initial state for encoding or transmission.

- `header`: The message header or partial header object, with fields like type, flags, and serial.
- `body`: Variable number of arguments representing the message body (payload data).

#### `toBuffer(): Buffer`

Converts the DBus message instance to a Buffer for transmission.
Encodes the header and body into a binary format following the DBus wire protocol.
Ensures proper alignment and padding as required by the specification, including
an 8-byte boundary for the total header length.

Returns: A Buffer containing the encoded DBus message ready to be sent over the wire.

Throws: {SerialError} If the message serial number is missing or invalid.

#### `data(): any[]`

Retrieves the data (body) of the DBus message.
Returns the payload or arguments contained in the message as an array.

Returns: An array of data elements from the message body.

#### `DBusMessage.encode(header: Partial<DBusMessageHeader>, ...body: any[]): Buffer`

Encodes a DBus message from a partial header and body data into a Buffer.
Static utility method to create and encode a message without instantiating it permanently.
Provides a convenient way to build a message with defaults and serialize it directly.

- `header`: A partial DBus message header with fields like type, flags, and serial.
- `body`: Variable number of arguments representing the message body (payload data).

Returns: A Buffer containing the encoded DBus message ready for transmission.

#### `DBusMessage.decode(header: Buffer, fieldsAndBody: Buffer, fieldsLength: number, bodyLength: number, decode?: DecodeOpts): DBusMessage`

Decodes a DBus message from raw buffers into a DBusMessage instance.
Parses the header and body from binary data following the DBus wire protocol.
Handles endianness, header fields, padding, and body decoding based on the signature.

- `header`: A Buffer containing the initial 16 bytes of the DBus message header.
- `fieldsAndBody`: A Buffer containing the header fields and body data.
- `fieldsLength`: The length of the header fields section in bytes.
- `bodyLength`: The length of the body section in bytes.
- `decode`: The connection's choices for giving the values (see DecodeOpts); `body` uses them.

Returns: A DBusMessage instance with parsed header and body content.

Throws: {MessageDecodeError} If the body cannot be decoded; the error carries the decoded header.

### class `DBusBufferEncoder`

A class for encoding data into a binary buffer following the DBus wire format.
Supports various DBus data types with proper alignment and endianness handling.
This class provides methods to encode basic types (e.g., integers, strings) and
container types (e.g., arrays, structs) as per the DBus specification.

Values are appended to a growable buffer, and every value is aligned relative to the start of the encoding,
which must itself be 8-byte aligned in the message (true for message headers and bodies).

#### `readonly endianness: DBusMessageEndianness`

The endianness used for encoding DBus messages.
Defaults to little-endian (LE) as it is the most common in DBus implementations.
Determines the byte order for multi-byte values in the message.

#### `allowUnixFd: boolean`

Whether UNIX_FD values may be written. Messages sent by this library cannot carry file descriptors (Node.js
sockets cannot pass them), so DBusMessage turns this off to reject such values instead of sending indexes
that refer to nothing.

#### `new DBusBufferEncoder(endianness?: DBusMessageEndianness, initBuffer?: Buffer, alignment?: number): DBusBufferEncoder`

Constructor for DBusBufferEncoder.
Initializes the encoder with the specified endianness and an optional initial buffer.
Optionally aligns the buffer to a specified boundary if provided.

- `endianness`: The byte order for encoding (little-endian or big-endian, default: Little Endian).
- `initBuffer`: An initial buffer to start with, if any (default: empty buffer).
- `alignment`: An initial alignment requirement, if specified, to align the buffer start.

#### `writeByte(value: number): this`

Encodes a BYTE type value into the buffer.
BYTE is an 8-bit unsigned integer (0-255) with no specific alignment requirement.

- `value`: The byte value to encode (0-255).

Returns: This instance for method chaining.

#### `writeBoolean(value: boolean): this`

Encodes a BOOLEAN type value into the buffer.
BOOLEAN is stored as a 32-bit integer (0 for false, 1 for true) with 4-byte alignment.

- `value`: The boolean value to encode.

Returns: This instance for method chaining.

#### `writeInt16(value: number): this`

Encodes an INT16 type value into the buffer.
INT16 is a 16-bit signed integer with 2-byte alignment.

- `value`: The 16-bit signed integer value to encode.

Returns: This instance for method chaining.

#### `writeUInt16(value: number): this`

Encodes a UINT16 type value into the buffer.
UINT16 is a 16-bit unsigned integer with 2-byte alignment.

- `value`: The 16-bit unsigned integer value to encode.

Returns: This instance for method chaining.

#### `writeInt32(value: number): this`

Encodes an INT32 type value into the buffer.
INT32 is a 32-bit signed integer with 4-byte alignment.

- `value`: The 32-bit signed integer value to encode.

Returns: This instance for method chaining.

#### `writeUInt32(value: number): this`

Encodes a UINT32 type value into the buffer.
UINT32 is a 32-bit unsigned integer with 4-byte alignment.

- `value`: The 32-bit unsigned integer value to encode.

Returns: This instance for method chaining.

#### `writeInt64(value: bigint): this`

Encodes an INT64 type value into the buffer.
INT64 is a 64-bit signed integer with 8-byte alignment.

- `value`: The 64-bit signed integer value to encode as a bigint.

Returns: This instance for method chaining.

#### `writeUInt64(value: bigint): this`

Encodes a UINT64 type value into the buffer.
UINT64 is a 64-bit unsigned integer with 8-byte alignment.

- `value`: The 64-bit unsigned integer value to encode as a bigint.

Returns: This instance for method chaining.

#### `writeDouble(value: number): this`

Encodes a DOUBLE type value into the buffer.
DOUBLE is a 64-bit IEEE 754 floating-point number with 8-byte alignment.

- `value`: The double-precision floating-point value to encode.

Returns: This instance for method chaining.

#### `writeUnixFD(fdIndex: number): this`

Encodes a UNIX_FD type value into the buffer.
UNIX_FD is a 32-bit unsigned integer representing a file descriptor index and requires 4-byte alignment.

- `fdIndex`: The file descriptor index to encode.

Returns: This instance for method chaining.

#### `writeString(value: string): this`

Encodes a STRING type value into the buffer.
STRING is a UTF-8 encoded string, prefixed by a 32-bit length, followed by a null terminator, with 4-byte alignment.

- `value`: The string value to encode.

Returns: This instance for method chaining.

#### `writeObjectPath(value: string): this`

Encodes an OBJECT_PATH type value into the buffer.
OBJECT_PATH is a string representing a DBus object path, encoded like a STRING with 4-byte alignment.
Validates the path format before encoding.

- `value`: The object path string to encode.

Returns: This instance for method chaining.

Throws: {ObjectPathError} If the object path format is invalid.

#### `writeSignature(value: string): this`

Encodes a SIGNATURE type value into the buffer.
SIGNATURE is a string of type codes, prefixed by an 8-bit length, followed by a null terminator, with 1-byte alignment.

- `value`: The signature string to encode.

Returns: This instance for method chaining.

Throws: {SignatureError} If the signature length exceeds 255 bytes.

#### `writeArray(signedValues: DBusSignedValue[], arrayItemSignature?: string): this`

Encodes an ARRAY type value into the buffer.
ARRAY is a sequence of elements of the same type, prefixed by a 32-bit length (in bytes) with 4-byte alignment.
The elements start at the next boundary of the element type's alignment, even when the array is empty; that
padding is not counted in the length.

- `signedValues`: An array of DBusSignedValue instances representing the elements to encode.
- `arrayItemSignature`: The type code of the array elements (e.g., 'i', '{', '(').

Returns: This instance for method chaining.

#### `writeStruct(signedValues: DBusSignedValue[]): this`

Encodes a STRUCT type value into the buffer.
STRUCT is a sequence of fields of potentially different types, with 8-byte alignment at the start.

- `signedValues`: An array of DBusSignedValue instances representing the struct fields.

Returns: This instance for method chaining.

#### `writeDictEntry(signedValues: DBusSignedValue[]): this`

Encodes a DICT_ENTRY type value into the buffer.
DICT_ENTRY is a key-value pair with 8-byte alignment, used within arrays to form dictionaries.

- `signedValues`: An array of exactly two DBusSignedValue instances (key and value).

Returns: This instance for method chaining.

Throws: {SignatureError} If the number of elements is not exactly 2.

#### `writeVariant(signedValue: DBusSignedValue): this`

Encodes a VARIANT type value into the buffer.
VARIANT is a dynamic type container with a signature followed by the value, with 1-byte alignment.

- `signedValue`: The DBusSignedValue instance representing the variant's content.

Returns: This instance for method chaining.

#### `writeSignedValue(signedValue: DBusSignedValue): this`

Encodes a DBusSignedValue into the buffer based on its signature.
Routes the encoding to the appropriate method based on the type signature of the value.

- `signedValue`: The DBusSignedValue instance to encode.

Returns: This instance for method chaining.

Throws: {SignatureError} If the signature type is unsupported.

#### `getBuffer(): Buffer`

Retrieves the current encoded buffer.
Returns the buffer containing all data encoded so far.

Returns: The current buffer with encoded data.

#### `encode(signature: string, value: any | DBusSignedValue | DBusSignedValue[], debug?: boolean): Buffer`

Encodes a value or set of values based on a DBus signature.
Parses the input value(s) into DBusSignedValue instances based on the signature and encodes them into the buffer.

- `signature`: The DBus signature defining the type(s) of the value(s) to encode.
- `value`: The value(s) to encode, can be raw data or already wrapped as DBusSignedValue(s).
- `debug`: If true, logs the parsed DBusSignedValue instances for debugging purposes (default: false).

Returns: The encoded buffer containing the data.

### class `DBusBufferDecoder`

A decoder for reading DBus data from a binary buffer, following the DBus wire format.
Supports various DBus data types with proper alignment and endianness handling.
This class provides methods to decode basic types (e.g., integers, strings) and
container types (e.g., arrays, structs) as per the DBus specification.

#### `readonly endianness: DBusMessageEndianness`

The endianness of the buffer data (Little Endian or Big Endian).
Default is Little Endian (LE) as specified by DBusMessageEndianness.LE,
which determines how multi-byte values are read from the buffer.

#### `new DBusBufferDecoder(endianness: DBusMessageEndianness | undefined, buffer: Buffer, offset?: number): DBusBufferDecoder`

Creates a new DBusBufferDecoder instance.
Initializes the decoder with the specified endianness and buffer,
optionally setting the initial offset for reading.

- `endianness`: The endianness to use for reading multi-byte values (default: Little Endian).
- `buffer`: The binary buffer containing the DBus data to decode.
- `offset`: The initial offset to start reading from (default: 0).

#### `readByte(): DBusSignedValue`

Reads a BYTE type value from the buffer.
BYTE is an 8-bit unsigned integer with no specific alignment requirement (1-byte alignment).

Returns: The byte value (0-255) wrapped in a DBusSignedValue instance with signature 'y'.

Throws: {ReadBufferError} If there are not enough bytes left in the buffer to read a BYTE.

#### `readBoolean(): DBusSignedValue`

Reads a BOOLEAN type value from the buffer.
BOOLEAN is stored as a 32-bit unsigned integer (0 for false, 1 for true) and requires 4-byte alignment.

Returns: The boolean value (true or false) wrapped in a DBusSignedValue instance with signature 'b'.

Throws: {ReadBufferError} If there are not enough bytes left in the buffer to read a BOOLEAN.

Throws: {InvalidValueError} If the read value is neither 0 nor 1.

#### `readInt16(): DBusSignedValue`

Reads an INT16 type value from the buffer.
INT16 is a 16-bit signed integer and requires 2-byte alignment.

Returns: The 16-bit signed integer value wrapped in a DBusSignedValue instance with signature 'n'.

Throws: {ReadBufferError} If there are not enough bytes left in the buffer to read an INT16.

#### `readUInt16(): DBusSignedValue`

Reads a UINT16 type value from the buffer.
UINT16 is a 16-bit unsigned integer and requires 2-byte alignment.

Returns: The 16-bit unsigned integer value wrapped in a DBusSignedValue instance with signature 'q'.

Throws: {ReadBufferError} If there are not enough bytes left in the buffer to read a UINT16.

#### `readInt32(): DBusSignedValue`

Reads an INT32 type value from the buffer.
INT32 is a 32-bit signed integer and requires 4-byte alignment.

Returns: The 32-bit signed integer value wrapped in a DBusSignedValue instance with signature 'i'.

Throws: {ReadBufferError} If there are not enough bytes left in the buffer to read an INT32.

#### `readUInt32(): DBusSignedValue`

Reads a UINT32 type value from the buffer.
UINT32 is a 32-bit unsigned integer and requires 4-byte alignment.

Returns: The 32-bit unsigned integer value wrapped in a DBusSignedValue instance with signature 'u'.

Throws: {ReadBufferError} If there are not enough bytes left in the buffer to read a UINT32.

#### `readInt64(): DBusSignedValue`

Reads an INT64 type value from the buffer.
INT64 is a 64-bit signed integer and requires 8-byte alignment.

Returns: The 64-bit signed integer value as a bigint wrapped in a DBusSignedValue instance with signature 'x'.

Throws: {ReadBufferError} If there are not enough bytes left in the buffer to read an INT64.

#### `readUInt64(): DBusSignedValue`

Reads a UINT64 type value from the buffer.
UINT64 is a 64-bit unsigned integer and requires 8-byte alignment.

Returns: The 64-bit unsigned integer value as a bigint wrapped in a DBusSignedValue instance with signature 't'.

Throws: {ReadBufferError} If there are not enough bytes left in the buffer to read a UINT64.

#### `readDouble(): DBusSignedValue`

Reads a DOUBLE type value from the buffer.
DOUBLE is a 64-bit double-precision floating-point number and requires 8-byte alignment.

Returns: The double-precision floating-point value wrapped in a DBusSignedValue instance with signature 'd'.

Throws: {ReadBufferError} If there are not enough bytes left in the buffer to read a DOUBLE.

#### `readUnixFD(): DBusSignedValue`

Reads a UNIX_FD type value from the buffer.
UNIX_FD is a 32-bit unsigned integer representing a file descriptor index and requires 4-byte alignment.

Returns: The file descriptor index wrapped in a DBusSignedValue instance with signature 'h'.

Throws: {ReadBufferError} If there are not enough bytes left in the buffer to read a UNIX_FD.

#### `readString(): DBusSignedValue`

Reads a STRING type value from the buffer.
STRING consists of a 32-bit length field followed by UTF-8 encoded characters and a null terminator.
The length field requires 4-byte alignment.

Returns: The string value wrapped in a DBusSignedValue instance with signature 's'.

Throws: {ReadBufferError} If there are not enough bytes left in the buffer to read the STRING length or content.

Throws: {ReadBufferError} If the null terminator is not found or is invalid.

#### `readObjectPath(): DBusSignedValue`

Reads an OBJECT_PATH type value from the buffer.
OBJECT_PATH is a string with specific formatting rules, stored like STRING with a 32-bit length field.
The length field requires 4-byte alignment.

Returns: The object path as a string wrapped in a DBusSignedValue instance with signature 'o'.

Throws: {ReadBufferError} If there are not enough bytes left in the buffer to read the OBJECT_PATH length or content.

Throws: {ReadBufferError} If the null terminator is not found or is invalid.

#### `readSignature(validate?: boolean): DBusSignedValue`

Reads a SIGNATURE type value from the buffer.
SIGNATURE is a string of type codes with a 1-byte length field and no specific alignment requirement.

- `validate`: Whether to check the signature against the specification's rules (default true).

Returns: The signature as a string wrapped in a DBusSignedValue instance with signature 'g'.

Throws: {ReadBufferError} If there are not enough bytes left in the buffer to read the SIGNATURE length or content.

Throws: {ReadBufferError} If the null terminator is not found or is invalid.

Throws: {SignatureError} If validate is set and the signature breaks the rules.

#### `readArray(elementType: DataType): DBusSignedValue`

Reads an ARRAY type value from the buffer.
ARRAY starts with a 32-bit length field (total byte length of array data) and requires 4-byte alignment.
Elements are read within a sub-buffer to isolate alignment.

- `elementType`: The DataType of the array elements, required for parsing elements.

Returns: The array of elements wrapped in a DBusSignedValue instance with signature 'a{elementType}'.

Throws: {ReadBufferError} If there are not enough bytes left in the buffer to read the ARRAY length or content.

#### `readStruct(fieldTypes?: DataType[]): DBusSignedValue`

Reads a STRUCT type value from the buffer.
STRUCT is a sequence of fields and requires 8-byte alignment at the start.

- `fieldTypes`: The DataType array representing the types of struct fields.

Returns: The struct value as an array of fields wrapped in a DBusSignedValue instance with signature '('.

Throws: {SignatureError} If field types are not provided or empty.

#### `readDictEntry(keyType?: DataType, valueType?: DataType): DBusSignedValue`

Reads a DICT_ENTRY type value from the buffer.
DICT_ENTRY is a key-value pair used in dictionaries and requires 8-byte alignment at the start.

- `keyType`: The DataType representing the key type of the dictionary entry.
- `valueType`: The DataType representing the value type of the dictionary entry.

Returns: The dictionary entry value as a key-value pair wrapped in a DBusSignedValue instance with signature '{'.

Throws: {SignatureError} If key or value types are not provided.

#### `readVariant(): DBusSignedValue`

Reads a VARIANT type value from the buffer.
VARIANT is a dynamic type container with a signature field followed by data, no specific alignment required.

Returns: The variant value wrapped in a DBusSignedValue instance with signature 'v'.

Throws: {ReadBufferError} If there are not enough bytes left in the buffer to read the VARIANT signature or content.

Throws: {SignatureError} If the variant signature does not describe exactly one type.

#### `readSignedValue(type: DataType): DBusSignedValue`

Reads a single value from the buffer based on the provided DataType.
Dispatches the reading to the appropriate method based on the type signature.
Handles both basic and container types recursively.

- `type`: The DataType describing the type to read from the buffer.

Returns: The value wrapped in a DBusSignedValue instance with the appropriate signature.

Throws: {SignatureError} If the type is unsupported or has invalid child types for containers.

#### `decode(signature: string, opts?: DecodeOpts): any[]`

Decodes the values of a signature into JavaScript values, as DecodeOpts asks: plain values by default, or type
class instances where `types` asks for them.

- `signature`: The signature of the values, e.g. 'sa{sv}'.
- `opts`: How to give the values (see DecodeOpts).

```typescript
new DBusBufferDecoder(DBusMessageEndianness.LE, body).decode('a{sv}')                       // [{mtu: 1500}]
new DBusBufferDecoder(DBusMessageEndianness.LE, body).decode('a{sv}', {types: 'variants'})  // [{mtu: DBusUInt32}]
```

Returns: One value per complete type of the signature.

Throws: {SignatureError} If the signature is empty or invalid.

Throws: {InvalidValueError | ReadBufferError | AlignmentError} If the data is malformed.

## Option and data types

Types of options, callbacks and introspection data.

### interface `BusAddressConnectOpts`

Interface defining connection options for connecting to a DBus bus using a bus address.
Extends CommonConnectOpts to include shared connection settings alongside bus-specific options.

#### `busAddress?: string | undefined`

The DBus bus address to connect to.
This can be a string representing the address of the bus (e.g., 'unix:path=/var/run/dbus/system_bus_socket').
If not provided, a default or environment-based address (like DBUS_SESSION_BUS_ADDRESS) may be used.

#### `timeout?: number | undefined`

The timeout value in milliseconds for the connection attempt.
If not specified, a default timeout may be applied by the underlying implementation.

### interface `BusNameBasicInfo`

Interface defining basic information about a DBus bus name.

#### `name: string`

The well-known name or unique name of the bus connection.
This is the primary identifier for the service on the bus (e.g., 'org.freedesktop.DBus').

#### `uniqueName?: string | undefined`

The unique name assigned to the connection by the bus.
This is typically a string like ':1.42' and is only set for active connections.
If not available, it may be undefined.

#### `active: boolean`

Indicates whether the bus name is currently active.
True if the name is owned by an active connection, false otherwise.

#### `activatable: boolean`

Indicates whether the bus name can be activated.
True if the name is associated with a service that can be started automatically by the bus.

#### `pid?: number | undefined`

The process ID (PID) of the process owning the bus name.
This is only available for active connections and may be undefined if not available or applicable.

### type `ConnectOpts`

```typescript
type ConnectOpts = BusAddressConnectOpts |
    SocketConnectOpts |
    TCPConnectOpts |
    StreamConnectOpts
```

Type representing different connection options for connecting to a DBus bus.
This is a union type that allows for various connection configurations depending on the transport method.
It can be one of the following:
- BusAddressConnectOpts: For connecting using a bus address string (e.g., UNIX socket path).
- SocketConnectOpts: For connecting using a socket configuration.
- TCPConnectOpts: For connecting using TCP/IP settings.
- StreamConnectOpts: For connecting using a custom stream implementation.

### type `CreateConnectOpts`

```typescript
type CreateConnectOpts = ConnectOpts & HandshakeOpts
```

Type representing the combined options for creating a DBus connection.
This type extends both ConnectOpts (for specifying the transport and connection details)
and HandshakeOpts (for specifying authentication and handshake behavior during connection setup).
It allows for a comprehensive configuration of the DBus connection process.

### interface `CreateSignalEmitterOpts`

Interface defining options for creating a DBus signal emitter.
These options specify the scope of the signals to be emitted or listened to on the DBus.

#### `service: string`

The name of the service to associate with the signal emitter.
This is typically a well-known service name (e.g., 'org.freedesktop.DBus').

#### `uniqueName: string`

The unique name of the connection on the bus.
This can be a specific unique name (e.g., ':1.42') or '*' to match any unique name.

#### `objectPath: string`

The object path to associate with the signal emitter.
This can be a specific path (e.g., '/org/freedesktop/DBus') or '*' to match any object path.

#### `interface: string`

The interface name to associate with the signal emitter.
This can be a specific interface (e.g., 'org.freedesktop.DBus') or '*' to match any interface.

#### `decode?: DecodeOpts | undefined`

How to give the signals' arguments to this emitter's listeners, overriding the connection's DecodeOpts.

### interface `DataType`

Interface representing a DBus data type with its structure.
Used to define the type signature of data in DBus messages, including nested types.

#### `type: DBusTypeCode`

The type code representing a specific DBus data type or structural element.
This corresponds to one of the characters defined in the DBusTypeCode union.

#### `child?: DataType[] | undefined`

An optional array of child data types.
Used for composite types like arrays, structs, or dictionaries to define their nested structure.
For example, a struct might have child types for each of its fields.

### interface `DBusInterfaceOpts`

Interface defining options for a DBus interface.
Extends DBusObjectOpts to include additional properties specific to an interface on a DBus object.

#### `readonly iface: string`

The name of the DBus interface.
This is a string identifier for the interface (e.g., 'org.freedesktop.DBus.Properties').

#### `readonly dbusObject: DBusObject`

The DBusObject instance to which this interface belongs.
This links the interface to a specific object on the bus.

#### `readonly introspectInterface: IntrospectInterface`

The introspection data for this interface.
Contains metadata about the interface's methods, properties, and signals as per the DBus introspection format.

#### `readonly decode?: DecodeOpts | undefined`

How the proxy gives the values it receives, overriding the connection's DecodeOpts.

### interface `DBusMessageHeader`

Interface defining the structure of a DBus message header.
The header contains metadata about the message, such as its type, destination, and other control information.

#### `type: DBusMessageType`

The type of the DBus message.
This indicates whether the message is a method call, method return, error, or signal.

#### `flags: DBusMessageFlags`

Flags associated with the message.
These flags control behavior such as whether a reply is expected or if the message should be queued.

#### `protocolVersion: number`

The protocol version of the DBus message.
Typically set to 1 for the current DBus protocol specification.

#### `serial: number`

The serial number of the message.
A unique identifier for the message used to track replies and correlate responses.

#### `destination: string`

The destination service name for the message.
This is the name of the service or connection (e.g., 'org.freedesktop.DBus' or ':1.42') that should receive the message.

#### `path: string`

The object path associated with the message.
This specifies the target object on the destination service (e.g., '/org/freedesktop/DBus').

#### `interfaceName: string`

The name of the interface associated with the message.
This identifies the interface containing the method or signal (e.g., 'org.freedesktop.DBus.Properties').

#### `member: string`

The member name of the method or signal.
This specifies the particular method or signal being invoked or emitted (e.g., 'Get' or 'NameOwnerChanged').

#### `signature: string`

The signature of the message body.
A string describing the types of the data in the message body (e.g., 's' for a single string).

#### `sender: string`

The sender of the message.
This is the unique name of the connection sending the message (e.g., ':1.42').

#### `replySerial?: number | undefined`

The serial number of the message to which this is a reply.
Used to correlate a reply or error message with the original request. Optional and may be undefined.

#### `errorName?: string | undefined`

The name of the error, if the message type is an error.
This is a string identifier for the error (e.g., 'org.freedesktop.DBus.Error.UnknownMethod'). Optional and may be undefined.

### interface `DBusObjectManagerOpts`

What a DBusObjectManager is created with, by DBus.getObjectManager.

#### `dbus: DBus`

The connection.

#### `service: string`

The service's well-known name.

#### `uniqueName: string`

The unique name of the service's current owner.

#### `objectPath: string`

Path of the object implementing org.freedesktop.DBus.ObjectManager.

#### `decode?: DecodeOpts | undefined`

How property values are given, overriding the connection's DecodeOpts.

### interface `DBusObjectOpts`

Interface defining options for a DBus object.
Extends DBusServiceOpts to include additional properties specific to an object within a DBus service.

#### `readonly objectPath: string`

The object path of the DBus object.
This is a string representing the path to the object on the bus (e.g., '/org/freedesktop/DBus').

#### `readonly dbusService: DBusService`

The DBusService instance to which this object belongs.
This links the object to a specific service on the bus.

### interface `DBusServiceOpts`

Interface defining options for a DBus service.
These options are used to configure and identify a service on the DBus.

#### `readonly dbus: DBus`

The DBus instance representing the connection to the bus.
This is used to interact with the DBus system or session bus.

#### `readonly service: string`

The well-known name of the service.
This is a string identifier for the service on the bus (e.g., 'org.freedesktop.DBus').

#### `readonly uniqueName: string`

The unique name of the connection owning the service.
This is a string identifier for the specific connection (e.g., ':1.42') on the bus.

### type `DBusTypeCode`

```typescript
type DBusTypeCode = '('
    | '{'
    | 'y'
    | 'b'
    | 'n'
    | 'q'
    | 'i'
    | 'u'
    | 'x'
    | 't'
    | 'd'
    | 's'
    | 'o'
    | 'g'
    | 'a'
    | 'r'
    | 'v'
    | 'e'
    | 'h'
    | 'm'
    | '*'
    | '?'
    | '@'
    | '&'
    | '^'
```

Type representing DBus data type signatures.
These are single-character codes or symbols used to define the structure of DBus messages.
Each character corresponds to a specific data type or structural element as per the DBus specification.
- '(' : Start of a struct.
- '{' : Start of a dictionary entry.
- 'y' : Byte (8-bit unsigned integer).
- 'b' : Boolean.
- 'n' : 16-bit signed integer.
- 'q' : 16-bit unsigned integer.
- 'i' : 32-bit signed integer.
- 'u' : 32-bit unsigned integer.
- 'x' : 64-bit signed integer.
- 't' : 64-bit unsigned integer.
- 'd' : Double (64-bit floating-point).
- 's' : String.
- 'o' : Object path.
- 'g' : Signature (a string representing a type signature).
- 'a' : Array (followed by the element type).
- 'r' : Struct (used in some contexts to denote a structure).
- 'v' : Variant (a container for a value of any type).
- 'e' : Dictionary entry (used within a dictionary).
- 'h' : Unix file descriptor.
- 'm' : Maybe/optional type (used in some contexts).
- '*' : Wildcard for any type (used in matching or generic contexts).
- '?' : Placeholder for an unknown type.
- '@' : Reference to a type (used in some contexts).
- '&' : Pointer or reference type (used in some contexts).
- '^' : Escaped or special type (used in some contexts).

### interface `DecodeOpts`

How received values are given to you. Set defaults for a connection with DBus.connect({decode}) (or
LocalService.run({decode}) for the arguments a service's methods receive), and override them per call, proxy or
signal emitter.

```typescript
// Read a{sv} settings with the type of every variant kept, to change and send them back unchanged
const [settings] = await bus.invoke({..., method: 'GetSettings', decode: {types: 'variants'}})
```

#### `types?: "none" | "variants" | "all" | undefined`

Where values keep their DBus type, as type class instances (DBusUInt32, DBusArray, …) whose `signature` and
`value` tell the type and the plain value:
- 'none' (default): nowhere; everything is a plain value. Variants give their content. Values that came in
  variants are still sent back with their original type when the object holding them is sent again.
- 'variants': the content of each variant is a type class instance; everything else is plain.
- 'all': every value is a type class instance.

#### `dictionaries?: "object" | "map" | undefined`

What dictionaries (a{…}) become: 'object' (default), whose keys are strings, or 'map', a Map whose keys keep
their type (numbers, booleans, bigints).

#### `int64?: "number" | "bigint" | undefined`

What 64-bit integers (x, t) become: 'bigint' (default), or 'number' when the value is a safe integer
(within ±2^53 - 1); larger values stay bigint rather than losing precision.

### interface `DefineMethodArgumentOpts`

Interface defining options for a method argument in a DBus method definition.
Used to specify the metadata for input or output arguments of a DBus method.

#### `name?: string | undefined`

The optional name of the argument.
This can be used for documentation or introspection purposes. If not provided, the argument may be unnamed.

#### `type: string`

The DBus type signature of the argument.
This is a string representing the data type of the argument (e.g., 's' for string, 'i' for integer).

#### `annotations?: Record<string, string> | undefined`

Annotations to publish in the introspection data, as name → value,
e.g. {'org.freedesktop.DBus.Deprecated': 'true'}.

### interface `DefineMethodOpts`

Interface defining options for a DBus method.
Used to specify the metadata and implementation of a method exposed on a DBus interface.

#### `name: string`

The name of the method.
This is the identifier used to call the method via DBus (e.g., 'GetProperty').

#### `inputArgs?: DefineMethodArgumentOpts[] | undefined`

An optional array of input arguments for the method.
Each argument is defined with its type and optional name for introspection purposes.

#### `outputArgs?: DefineMethodArgumentOpts[] | undefined`

An optional array of output arguments for the method.
Each argument is defined with its type and optional name for introspection purposes.

#### `method: (...args: any[]) => Promise<any | any[]> | any | any[]`

The handler. It receives the input arguments in order as plain values (and the context last with
withContext), may be async, and returns: the value of the single output argument; an array with one value per
output argument when there are several; anything (ignored) when there are none. A thrown error becomes a DBus
error reply named after its `name` if that is a valid DBus error name (see createDBusError), otherwise
'<service name>.<name>', or '<service name>.Error'.

#### `withContext?: boolean | undefined`

Whether the method also receives the call's context (the caller's bus name and more, see MethodCallContext)
as an extra last argument, after the input arguments. Defaults to false.
When the method is called directly through LocalInterface.callMethod, there is no call and the context is undefined.

#### `annotations?: Record<string, string> | undefined`

Annotations to publish in the introspection data, as name → value,
e.g. {'org.freedesktop.DBus.Deprecated': 'true'}.

### interface `DefinePropertyOpts`

Interface defining options for a DBus property.
Used to specify the metadata and behavior of a property exposed on a DBus interface,
enabling the definition of property characteristics, access methods, and change notifications.

#### `name: string`

The name of the property.
This is the identifier used to access the property via DBus (e.g., 'Volume', 'IsPlaying'),
and must conform to DBus naming conventions for properties.

#### `type: string`

The DBus type signature of the property.
This is a string representing the data type of the property as per DBus type system
(e.g., 's' for string, 'i' for integer, 'b' for boolean, 'as' for array of strings).

#### `emitPropertiesChanged?: boolean | EmitPropertiesChangedOpts | undefined`

Configuration for emitting the 'PropertiesChanged' signal when the property value changes.
Can be a boolean (true to emit the signal with default behavior, false to disable emission)
or an object of type EmitPropertiesChangedOpts to specify detailed options such as whether
to include the new value in the signal.

#### `getter?: (() => any) | undefined`

An optional getter function for retrieving the property value.
This function is called when the property is accessed via DBus (e.g., through the 'Get' method)
and can return the value synchronously. If not provided, the property is considered write-only
and attempts to read it may result in an error or default behavior depending on implementation.

#### `setter?: ((value: any) => unknown) | undefined`

An optional setter function for updating the property value.
This function takes the new value as an argument and is called when the property is modified
via DBus (e.g., through the 'Set' method). It may return a Promise, which is awaited before the call is
answered; an error it throws or rejects with is returned to the caller as a DBus error (use createDBusError
to choose the error name). If not provided, the property is read-only.

#### `annotations?: Record<string, string> | undefined`

Annotations to publish in the introspection data, as name → value,
e.g. {'org.freedesktop.DBus.Deprecated': 'true'}.

### interface `DefineSignalArgumentOpts`

Interface defining options for an argument of a DBus signal.

#### `name?: string | undefined`

The optional name of the argument, for introspection.

#### `type: string`

The DBus type signature of the argument (e.g., 's' for string, 'u' for unsigned integer).

#### `annotations?: Record<string, string> | undefined`

Annotations to publish in the introspection data, as name → value.

### interface `DefineSignalOpts`

Interface defining options for a DBus signal.
Used to specify the metadata and behavior of a signal exposed on a DBus interface.

#### `name: string`

The name of the signal.
This is the identifier used to emit or listen for the signal via DBus (e.g., 'NameOwnerChanged').

#### `args?: DefineSignalArgumentOpts[] | undefined`

An optional array of arguments for the signal.
Each argument is defined with metadata (e.g., name and type) for introspection purposes.

#### `eventEmitter: EventEmitter`

The EventEmitter instance associated with the signal.
This is used to handle the emission and subscription of events for the signal in the application.

#### `annotations?: Record<string, string> | undefined`

Annotations to publish in the introspection data, as name → value,
e.g. {'org.freedesktop.DBus.Deprecated': 'true'}.

### interface `EmitPropertiesChangedOpts`

Interface defining options for emitting property change signals in DBus.
Used to configure how property changes are signaled to other applications on the bus
when a property value is updated, allowing control over the content of the emitted signal.

#### `emitValue: boolean`

A boolean flag indicating whether to include the new value of the property in the change signal.
If true, the updated value is included in the 'PropertiesChanged' signal sent over DBus;
if false, the signal indicates a change without providing the new value (invalidated only).

### interface `EmitSignalOpts`

Interface defining options for emitting a DBus signal.
Used to specify the metadata and content of a signal to be sent over the DBus.

#### `objectPath: string`

The object path associated with the signal.
This specifies the path of the object emitting the signal (e.g., '/org/freedesktop/DBus').

#### `interface: string`

The interface name associated with the signal.
This identifies the interface that defines the signal (e.g., 'org.freedesktop.DBus.Properties').

#### `signal: string`

The name of the signal to emit.
This is the specific signal identifier (e.g., 'PropertiesChanged').

#### `signature?: string | undefined`

The optional type signature of the signal's data.
This is a string describing the types of the data arguments (e.g., 'sai' for string, array of integers).
If not provided, it may be inferred or default to an empty signature.

#### `destination?: string | undefined`

The optional destination for the signal.
This specifies the unique name or service name of the intended recipient (e.g., ':1.42').
If not provided, the signal is broadcast to all listeners on the bus.

#### `data?: any[] | undefined`

The optional data payload for the signal.
This is an array of values to be sent with the signal, matching the signature if provided.

### interface `GetPropertyValueOpts`

Interface defining options for retrieving a property value from a DBus object.
Used to specify the target service, object, interface, and property to query.

#### `service: string`

The name of the service hosting the property.
This is typically a well-known service name (e.g., 'org.freedesktop.DBus').

#### `objectPath: string`

The object path of the DBus object containing the property.
This specifies the path of the target object (e.g., '/org/freedesktop/DBus').

#### `interface: string`

The interface name that defines the property.
This identifies the interface containing the property (e.g., 'org.freedesktop.DBus.Properties').

#### `property: string`

The name of the property to retrieve.
This is the specific property identifier (e.g., 'Names').

#### `decode?: DecodeOpts | undefined`

How to give the value, overriding the connection's DecodeOpts for this call.

### interface `HandshakeOpts`

Interface defining options for the DBus handshake process.
Used to configure authentication and connection behavior during the initial connection to a DBus server.

#### `authMethods?: string[] | undefined`

An optional array of authentication methods to use during the handshake.
These specify the mechanisms for authenticating with the DBus server (e.g., 'EXTERNAL', 'DBUS_COOKIE_SHA1').
If not provided, a default set of methods may be used.

#### `uid?: number | undefined`

An optional user ID (UID) to present during authentication.
This may be used with certain authentication mechanisms to identify the connecting user.
If not provided, the system may use the effective UID of the process.

### interface `IntrospectAnnotation`

An annotation of an interface, method, argument, property or signal in introspection data, such as
org.freedesktop.DBus.Deprecated or org.freedesktop.DBus.Property.EmitsChangedSignal.

#### `name: string`

The annotation's name, e.g. 'org.freedesktop.DBus.Deprecated'.

#### `value: string`

The annotation's value, e.g. 'true'.

### interface `IntrospectInterface`

Interface defining the structure of introspection data for a DBus interface.
Used to describe the methods, properties, and signals available on a specific interface during introspection.

#### `name: string`

The name of the DBus interface.
This is a string identifier for the interface (e.g., 'org.freedesktop.DBus.Properties').

#### `method: IntrospectMethod[]`

An array of methods defined in the interface.
Each method contains metadata such as its name, arguments, and return types for introspection purposes.

#### `property: IntrospectProperty[]`

An array of properties defined in the interface.
Each property contains metadata such as its name, type, and access permissions (read/write) for introspection purposes.

#### `signal: IntrospectSignal[]`

An array of signals defined in the interface.
Each signal contains metadata such as its name and arguments for introspection purposes.

#### `annotation?: IntrospectAnnotation[] | undefined`

The interface's annotations from the introspection data, e.g. [{name: 'org.freedesktop.DBus.Deprecated', value: 'true'}];
absent when it has none.

### interface `IntrospectMethod`

Interface defining the structure of introspection data for a DBus method.
Used to describe a method available on a DBus interface during introspection.

#### `name: string`

The name of the method.
This is a string identifier for the method (e.g., 'GetProperty').

#### `arg: IntrospectMethodArgument[]`

An array of arguments for the method.
Each argument contains metadata such as its name, type, and direction (input or output) for introspection purposes.

#### `annotation?: IntrospectAnnotation[] | undefined`

The method's annotations from the introspection data, e.g. [{name: 'org.freedesktop.DBus.Deprecated', value: 'true'}];
absent when it has none.

### interface `IntrospectMethodArgument`

Interface defining the structure of introspection data for a DBus method argument.
Used to describe an argument of a method on a DBus interface during introspection.

#### `name?: string | undefined`

The optional name of the argument.
This can be used for documentation or introspection purposes. If not provided, the argument may be unnamed.

#### `type: string`

The DBus type signature of the argument.
This is a string representing the data type of the argument (e.g., 's' for string, 'i' for integer).

#### `direction: string`

The direction of the argument.
Indicates whether the argument is an input ('in') or output ('out') parameter for the method.

#### `annotation?: IntrospectAnnotation[] | undefined`

The argument's annotations from the introspection data, e.g. [{name: 'org.freedesktop.DBus.Deprecated', value: 'true'}];
absent when it has none.

### interface `IntrospectNode`

Interface defining the structure of introspection data for a DBus object node.
Used to describe the interfaces available on a specific object node during introspection.

#### `interface: IntrospectInterface[]`

An array of interfaces defined for the DBus object node.
Each interface contains metadata about its methods, properties, and signals for introspection purposes.

### interface `IntrospectProperty`

Interface defining the structure of introspection data for a DBus property.
Used to describe a property available on a DBus interface during introspection.

#### `name: string`

The name of the property.
This is a string identifier for the property (e.g., 'Volume').

#### `type: string`

The DBus type signature of the property.
This is a string representing the data type of the property (e.g., 's' for string, 'i' for integer).

#### `access: DBusPropertyAccess`

The access permissions for the property.
This specifies whether the property is read-only, write-only, or read-write.
It uses the DBusPropertyAccess enum or type to define the access level.

#### `annotation?: IntrospectAnnotation[] | undefined`

The property's annotations from the introspection data, e.g. [{name: 'org.freedesktop.DBus.Deprecated', value: 'true'}];
absent when it has none.

### interface `IntrospectSignal`

Interface defining the structure of introspection data for a DBus signal.
Used to describe a signal available on a DBus interface during introspection.

#### `name: string`

The name of the signal.
This is a string identifier for the signal (e.g., 'PropertiesChanged').

#### `arg: IntrospectSignalArgument[]`

An array of arguments for the signal.
Each argument contains metadata such as its name and type for introspection purposes.

#### `annotation?: IntrospectAnnotation[] | undefined`

The signal's annotations from the introspection data, e.g. [{name: 'org.freedesktop.DBus.Deprecated', value: 'true'}];
absent when it has none.

### interface `IntrospectSignalArgument`

Interface defining the structure of introspection data for a DBus signal argument.
Used to describe an argument of a signal on a DBus interface during introspection.

#### `name?: string | undefined`

The name of the argument.
This is used for documentation or introspection purposes to identify the argument.

#### `type: string`

The DBus type signature of the argument.
This is a string representing the data type of the argument (e.g., 's' for string, 'i' for integer).

#### `annotation?: IntrospectAnnotation[] | undefined`

The argument's annotations from the introspection data, e.g. [{name: 'org.freedesktop.DBus.Deprecated', value: 'true'}];
absent when it has none.

### interface `InvokeOpts`

Interface defining options for invoking a method on a DBus object.
Used to specify the target service, object, interface, method, and arguments for a remote method call.

#### `service: string`

The name of the service hosting the method.
This is typically a well-known service name (e.g., 'org.freedesktop.DBus').

#### `objectPath: string`

The object path of the DBus object containing the method.
This specifies the path of the target object (e.g., '/org/freedesktop/DBus').

#### `interface: string`

The interface name that defines the method.
This identifies the interface containing the method (e.g., 'org.freedesktop.DBus.Properties').

#### `method: string`

The name of the method to invoke.
This is the specific method identifier (e.g., 'Get').

#### `signature?: string | undefined`

The optional type signature of the method's arguments.
This is a string describing the types of the arguments (e.g., 's' for string, 'i' for integer).
If not provided, it may be inferred or default to an empty signature.

#### `args?: any[] | undefined`

The optional arguments to pass to the method.
This is an array of values matching the signature if provided.

#### `timeout?: number | undefined`

Milliseconds to wait for the reply before the call is rejected with a TimeoutError.
Defaults to the connection's callTimeout; without either, the call waits until a reply arrives or the
connection closes.

#### `noReply?: boolean | undefined`

Send the call without waiting for a reply (NO_REPLY_EXPECTED); invoke then returns nothing.

#### `decode?: DecodeOpts | undefined`

How to give the reply's values, overriding the connection's DecodeOpts for this call.

### interface `LocalServiceOpts`

Options for creating a LocalService.

#### `objectManagerPath?: string | null | undefined`

Where the service's org.freedesktop.DBus.ObjectManager is, which announces objects as they are added and
removed: '/' by default, a path such as '/org/example/App' to manage only the objects below it (the service
creates an object there; add interfaces to it with service.getObject(path)), or null for no object manager.
More managers can be added by adding an ObjectManagerInterface to any object; each object is reported by its
nearest manager above it.

### type `MethodCall`

```typescript
type MethodCall = (...args: any[]) => Promise<any>
```

A method of DBusInterface.method: takes the input arguments in order, as plain values typed by the introspected
signature, and resolves with undefined when the method returns nothing, the value when it returns one, or an array
when it returns several. Rejects with the DBus error the service replied with (`name` is the DBus error name).

### interface `MethodCallContext`

Information about the call a method handler is answering, passed to handlers defined with `withContext: true`.
Typically used for access control, e.g. asking polkit whether `sender` may perform the action.

#### `sender: string`

Unique bus name of the caller (e.g. ':1.42'), as stamped on the message by the bus.

#### `objectPath: string`

Object path the method was called on.

#### `interface: string`

Interface the method belongs to.

#### `method: string`

Name of the called method.

#### `message: DBusMessage`

The method call message itself, for anything else in its header.

### type `NamedMethodCall`

```typescript
type NamedMethodCall = (parameterObject?: Record<string, any>) => Promise<any>
```

A method of DBusInterface.namedMethod: takes the input arguments as one object keyed by the introspected argument
names, and resolves like DBusInterface.method: undefined, the single return value, or an array of them.

Throws: {NotEnoughParamsError} When an input argument is missing from the object.

### type `NamedNoReplyMethodCall`

```typescript
type NamedNoReplyMethodCall = (parameterObject?: Record<string, any>) => void
```

A method of DBusInterface.namedNoReplyMethod: takes the input arguments as one object keyed by the introspected
argument names and sends the call without waiting for a reply.

### type `NoReplyMethodCall`

```typescript
type NoReplyMethodCall = (...args: any[]) => void
```

A method of DBusInterface.noReplyMethod: takes the input arguments in order and sends the call with
NO_REPLY_EXPECTED. It returns immediately; any result or error of the call is never seen.

### interface `PropertyOperation`

Interface defining operations for interacting with a DBus property.
Used to provide methods for getting and setting the value of a property on a DBus object.

#### `set(value: any): Promise<void>`

Sets the value of the property.
This method sends the provided value to the DBus object to update the property.

- `value`: The value to set for the property.

Returns: A Promise that resolves when the property value is successfully set.

#### `get(): Promise<any>`

Retrieves the current value of the property.
This method queries the DBus object to get the current value of the property.

Returns: A Promise that resolves with the current value of the property.

### interface `ProxyOpts`

Options for proxies: interfaces (DBus.getInterface, DBusObject.getInterface) and object managers
(DBus.getObjectManager).

#### `decode?: DecodeOpts | undefined`

How to give the values the proxy receives (method results, property values, signal arguments), overriding
the connection's DecodeOpts.

```typescript
const connection = await bus.getInterface('org.freedesktop.NetworkManager', path, 'org.freedesktop.NetworkManager.Settings.Connection', {decode: {types: 'variants'}})
```

### interface `ReceivedSignal`

A signal as received, with where it came from: what DBusSignalEmitter.onAny listeners get.

#### `sender: string`

Unique bus name of the sender, e.g. ':1.42'.

#### `objectPath: string`

Object path the signal was emitted from.

#### `interface: string`

Interface of the signal.

#### `name: string`

Name of the signal, e.g. 'PropertiesChanged'.

#### `args: any[]`

The signal's arguments, as a listener of the signal's name receives them.

#### `message: DBusMessage`

The signal message itself, for anything else in its header.

### interface `ReplyOpts`

Interface defining options for sending a reply to a DBus method call.
Used to specify the details of a response message, including the destination and data.

#### `destination: string`

The destination service or client to which the reply is sent.
This identifies the recipient of the reply message (e.g., a unique connection name or well-known service name).

#### `replySerial: number`

The serial number of the original method call message to which this is a reply.
This is used to match the reply with the original request.

#### `signature?: string | undefined`

The optional type signature of the reply data.
This is a string describing the types of the data being returned (e.g., 's' for string, 'i' for integer).
If not provided, it may be inferred or default to an empty signature.

#### `data?: any[] | Error | undefined`

The optional data or error to include in the reply.
This can be an array of values matching the signature if provided, or an Error object if the reply indicates failure.

### interface `SetPropertyValueOpts`

Interface defining options for setting the value of a DBus property.
Used to specify the target service, object, interface, property, and value for updating a property on a DBus object.

#### `service: string`

The name of the service hosting the property.
This is typically a well-known service name (e.g., 'org.freedesktop.DBus').

#### `objectPath: string`

The object path of the DBus object containing the property.
This specifies the path of the target object (e.g., '/org/freedesktop/DBus').

#### `interface: string`

The interface name that defines the property.
This identifies the interface containing the property (e.g., 'org.freedesktop.DBus.Properties').

#### `property: string`

The name of the property to set.
This is the specific property identifier (e.g., 'Volume').

#### `value: any`

The value to set for the property.
This can be of any type, depending on the property's expected type.

#### `signature?: string | undefined`

The optional type signature of the property's value.
This is a string describing the type of the value (e.g., 's' for string, 'i' for integer).
If not provided, it may be inferred or default to an empty signature.

### interface `SocketConnectOpts`

Interface defining options for connecting to a DBus socket.
Used to specify the socket path and connection timeout settings.
Extends CommonConnectOpts to include shared connection settings alongside socket-specific options.

#### `socket: string`

The path or address of the socket to connect to.
This could be a file path for a Unix socket (e.g., '/var/run/dbus/system_bus_socket')
or another type of socket identifier depending on the transport.

#### `timeout?: number | undefined`

The optional timeout for the connection attempt, in milliseconds.
If not specified, a default timeout may be used or the connection may block indefinitely.

### interface `StopServiceOpts`

Options for stopping a LocalService.

#### `graceful?: boolean | undefined`

Stop in two phases: first answer new method calls with org.freedesktop.DBus.Error.ServiceUnknown and wait for
the calls being handled to finish, then release the name and disconnect. Without it (the default), the name is
released and the connection closed immediately, and replies of calls still being handled are lost.

#### `timeout?: number | undefined`

With graceful, the longest time in milliseconds to wait for calls being handled before stopping anyway.
Without it, stop waits until every call has finished.

### interface `StreamConnectOpts`

Interface defining options for connecting to a DBus service using a stream.
Used to specify a duplex stream for communication with the DBus.
Extends CommonConnectOpts to include shared connection settings alongside stream-specific options.

#### `stream: Duplex`

The duplex stream to use for communication.
This stream handles both reading from and writing to the DBus connection.

### interface `TCPConnectOpts`

Interface defining options for connecting to a DBus service over TCP.
Used to specify the host, port, and timeout settings for a TCP connection.
Extends CommonConnectOpts to include shared connection settings alongside TCP-specific options.

#### `host: string`

The hostname or IP address of the DBus server to connect to.
This specifies the target server for the TCP connection (e.g., 'localhost' or '192.168.1.100').

#### `port: number`

The port number on which the DBus server is listening.
This specifies the target port for the TCP connection (e.g., DBus default port).

#### `timeout?: number | undefined`

The optional timeout for the connection attempt, in milliseconds.
If not specified, a default timeout may be used or the connection may block indefinitely.
