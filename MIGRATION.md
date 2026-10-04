# Migrating from 1.x to 2.0

Version 2.0 makes the API names consistent and fixes behaviour that silently corrupted data or crashed processes.
Several of those fixes change what valid code observes. This guide lists every incompatible change and how to update
code.

The names follow a few rules:

- `list…` methods return names or paths. `get…` methods return objects. This holds on the client and the service side.
- Events and functions are camelCase. Types are PascalCase.
- Unsigned integer types are spelled `UInt`, as in `Buffer.writeUInt32`.

## Renamed

### Client (`DBus`, `DBusService`, `DBusObject`, `DBusInterface`)

| 1.x | 2.0 |
|---|---|
| `DBusService.listObjects()` | `DBusService.listObjectPaths()` |
| `DBusObject.listInterfaces()` | `DBusObject.listInterfaceNames()` |
| `DBusInterface.parameterObjectifyMethod` | `DBusInterface.namedMethod` |
| `DBusInterface.parameterObjectifyNoReplyMethod` | `DBusInterface.namedNoReplyMethod` |
| `dbus.invoke(opts, true)` | `dbus.invoke({...opts, noReply: true})` |
| event `online` | `serviceOnline` |
| event `offline` | `serviceOffline` |
| event `replaced` | `serviceReplaced` |
| event `NameOwnerChanged` | `nameOwnerChanged` |
| event `NameAcquired` | `nameAcquired` |
| event `NameLost` | `nameLost` |

`connectionClose`, `connectionError` and `methodCall` are unchanged. The methods named after the bus's own methods
(`requestName`, `nameHasOwner`, `getNameOwner`, …) are unchanged too.

### Service (`LocalService`, `LocalObject`, `LocalInterface`)

| 1.x | 2.0 |
|---|---|
| `LocalService.listObjects()` → `Record<path, LocalObject>` | `LocalService.getObjects()` → `LocalObject[]` |
| `LocalService.findObjectByPath(path)` | `LocalService.getObject(path)` |
| `LocalObject.listInterfaces()` → `Record<name, LocalInterface>` | `LocalObject.getInterfaces()` → `LocalInterface[]` |
| `LocalObject.findInterfaceByName(name)` | `LocalObject.getInterface(name)` |
| `LocalObject.interfaceNames()` | `LocalObject.listInterfaceNames()` |
| `LocalInterface.methodNames()` | `LocalInterface.listMethodNames()` |
| `LocalInterface.propertyNames()` | `LocalInterface.listPropertyNames()` |
| `LocalInterface.signalNames()` | `LocalInterface.listSignalNames()` |
| `LocalInterface.callMethod(name, signature, ...args)` | `LocalInterface.callMethod(name, signature, args, context?)` |

If you used the records, `Object.fromEntries(service.getObjects().map(o => [o.name, o]))` rebuilds them.

`LocalService.dbus`, `LocalObject.service` and `LocalInterface.object` are now read-only, and `setService`/`setObject`
are internal. Objects and interfaces are linked by `addObject`/`addInterface` and unlinked by
`removeObject`/`removeInterface`.

### Types, functions and classes

| 1.x | 2.0 |
|---|---|
| `DBusUint16`, `DBusUint32`, `DBusUint64` | `DBusUInt16`, `DBusUInt32`, `DBusUInt64` |
| `CreateDBusError(name, message)` | `createDBusError(name, message)` |
| `Signature.parseSignature(signature)` | `Signature.parse(signature)` |
| `Signature.areSignaturesCompatible(a, b)` | `Signature.areCompatible(a, b)` |
| `DBusSignedValue.toJSON(values)` | `DBusSignedValue.toPlain(values)` |
| `emitPropertiesChangedOpts` | `EmitPropertiesChangedOpts` |
| `ReplyModeMethodCall`, `NoReplyModeMethodCall` | `MethodCall`, `NoReplyMethodCall` |
| `ReplyModeParameterObjectMethodCall`, `NoReplyModeParameterObjectMethodCall` | `NamedMethodCall`, `NamedNoReplyMethodCall` |
| `Types` | `DBusTypeCode` |
| `ServiceBasicInfo` | `BusNameBasicInfo` (it was an alias) |

`DBusSignedValue.toPlain` returns plain JavaScript values: bigint for 64-bit integers, Buffer for byte arrays, and NaN
or -0 where they occur. Unlike the old name suggested, the result cannot always be passed to `JSON.stringify`.

### Decoding options

`advancedResponse` and `convertBigIntToNumber` are replaced by `decode` (see `DecodeOpts` in the README). It can be
set for a connection, as before, and also per call, proxy, signal emitter or message.

| 1.x | 2.0 |
|---|---|
| `DBus.connect({advancedResponse: true})` | `DBus.connect({decode: {types: 'all'}})`, or per call: `invoke({…, decode: {types: 'all'}})` |
| `DBus.connect({convertBigIntToNumber: true})` | `DBus.connect({decode: {int64: 'number'}})` |
| `new DBusBufferDecoder(endianness, buffer, offset, convertBigIntToNumber)` | `new DBusBufferDecoder(endianness, buffer, offset)`, then `decode(signature, {int64: 'number'})` |
| `decoder.decode(signature, true)` | `decoder.decode(signature, {types: 'all'})` |
| `DBusMessage.decode(…, advancedResponse, convertBigIntToNumber)` | `DBusMessage.decode(…, decode)` |
| `new DBusConnection(stream, …, advancedResponse, convertBigIntToNumber)` | `new DBusConnection(stream, …, decode)` |

`int64: 'number'` converts only safe integers (within ±2^53 - 1). Larger values stay `bigint`. Before, they silently
lost precision.

### Typed values

| 1.x | 2.0 |
|---|---|
| `value.$signature` (the type code, e.g. `'a'`) | `value.signature`, the complete signature, e.g. `'a{sv}'` |
| `value.$value` (internal tree) | `value.value` for the plain value; `items` (`DBusArray`), `fields` (`DBusStruct`), `key` / `content` (`DBusDictEntry`), `content` (`DBusVariant`) for typed contents |
| `value.$arrayItemSignature` | the element type is part of `value.signature` |
| `DBusSignedValue.parse(signature, value)` | `new DBusSignedValue(signature, value)` for one type |
| `new DBusSignedValue(dataType, value)` with a parsed type | `new DBusSignedValue(signatureString, value)` |

## Removed

- `HandshakeOpts.simple` and `HandshakeOpts.direct`. They were never used and had no effect.
- `ObjectNotFoundError`. Nothing threw it.
- `PropertiesInterface.emitPropertiesChanged(interface, changed, invalidated)` is internal. Announce changes with
  `iface.emitPropertiesChanged(names)` on your `LocalInterface`, which also types the values correctly.
- `ObjectManagerInterface.interfacesAdded` / `interfacesRemoved` are internal. Adding and removing objects and
  interfaces sends the signals.

## Changed behaviour

- **Values are validated.** Values the DBus specification does not allow are rejected with `InvalidValueError`,
  `SignatureError` or `ObjectPathError`. Before, they were altered or sent as malformed messages:
  - integers that are out of range or not integers (a BYTE of 256 was sent as 0)
  - non-boolean values for `b`: the string `'false'` was sent as `true`
  - non-numbers for `d`
  - strings containing NUL
  - invalid signatures

  Received data is checked the same way. See "Validation" in the README.
- **Dictionaries given as objects convert their keys.** `{1: 'a'}` for `a{is}` and `{false: 'a'}` for `a{bs}` now
  encode the keys as numbers and booleans.
- **Arrays of objects are no longer merged.** `aa{sv}`, `aay` and `av` holding objects decode to arrays, as they
  should. Before, they were merged into a single object.
- **An empty `ay` decodes to an empty Buffer**, not `[]`.
- **Variant type inference.** These are the changes for plain values given for `v`:
  - An array of objects is sent as `aa{sv}`. Before, its objects were merged into one `a{sv}`.
  - An integer outside the INT32 range is sent as `x`. Before, it was rejected.
  - An array mixing integers and floats is sent as `ad`. Before, it became a struct.
  - `null`, `undefined` and functions are rejected with an `InvalidValueError` that says so.
- **Dictionaries from a `Map`.** A `Map` given for `a{..}` or for a variant is encoded with its entries, and its keys
  keep their types. Before, it was sent as an empty dictionary. A `Date`, `Set` or similar object given for a
  dictionary or a variant is rejected. Before, it also became an empty dictionary.
- **Object manager reports.** These are the changes on the service side:
  - Changes to the manager's own object are no longer announced. Before, adding an interface to `/` sent an
    `InterfacesAdded` for `/`, which `GetManagedObjects` does not list.
  - With nested managers, each object is reported by its nearest manager only.
  - Property values are read only while the service runs, when they are reported.
  - A property whose getter throws is left out of `GetAll`, `GetManagedObjects` and `InterfacesAdded`. Before, it
    made `addObject` and `addInterface` throw, even before the service ran, and made the whole `GetManagedObjects`
    call fail.
- **Signals after `stop()`.** Emitting a signal's event after the service stopped no longer throws a
  `Disconnected` error from your `emit` call. Nothing is sent.
- **Received values keep their types when sent again.** A value that came in a variant goes back out with the type
  it came with, when the object, array or Map holding it is sent again and the value still fits that type. Before, it
  got an inferred type: `u` came back as `i`, `o` as `s`, and an empty `as` as `ai`. Copies made by spreading or
  rebuilding the container infer types as before; decode with `types: 'variants'` to keep types in copies.
- **Container type classes check their contents when constructed.** `DBusArray`, `DBusStruct` and `DBusDictEntry`
  reject plain values and mixed types at once. Before, the encoder failed later with `Unsupported type: undefined`.
  `DBusArray` takes the element type of an empty array as a class or a signature (`new DBusArray([], 'a{sv}')`).
- **Messages without a signature.** A message with arguments but no signature used to be sent without its arguments.
  Now the signature is taken from the arguments when all of them are typed, and plain arguments without a signature
  are rejected.
- **Library errors have names.** `error.name` is the class name (`'TimeoutError'`, `'InvalidValueError'`, …) instead
  of `'Error'`. A library error thrown in a method handler therefore reaches the caller as `<service>.<ClassName>`
  instead of `<service>.Error`.
- **`LocalInterface.setProperty` returns a Promise.** It waits for the setter, which may be `async`. Use
  `await setProperty(...)` instead of `try/catch` around a synchronous call. Setters are now registered even without
  `emitPropertiesChanged`, and write-only properties work.
- **`getServices()` returns running services only.** It no longer starts every activatable service. Use
  `getService(name)` to start one.
- **`UNIX_FD` (`h`) values cannot be sent.** Node.js cannot pass file descriptors, so messages containing them are
  rejected with an error instead of being sent with indexes that refer to nothing.
- **Pending calls settle when the connection closes.** They are rejected with `org.freedesktop.DBus.Error.Disconnected`
  instead of never settling.
- **Machine ID.** `Peer.GetMachineId` returns the machine ID dbus uses: `/etc/machine-id` or
  `/var/lib/dbus/machine-id`, or Homebrew's on macOS. Without one, it returns a random ID per process. Before, it
  returned the hardware UUID. The `native-machine-id` dependency is gone, so installing no longer compiles native code.

## New

- `DBus.getObjectManager(service, path)`: a client for a service's ObjectManager. It keeps a copy of the managed
  objects and emits `objectAdded`, `objectRemoved`, `interfacesAdded`, `interfacesRemoved` and `propertiesChanged`.
- `LocalInterface.emitPropertiesChanged(names)` announces properties the service changed itself, e.g. read-only ones.
- `new LocalService(name, {objectManagerPath})` puts the object manager on another path, or leaves it out with
  `null`. More managers can be nested by adding an `ObjectManagerInterface` to other objects.
- `DBusSignalEmitter.onAny(listener)` receives every selected signal with its sender, object path, interface and name.
- `DBus.connected` tells whether the connection is open.
- `DecodeOpts`: `types` (`'none'`, `'variants'`, `'all'`), `dictionaries` (`'object'`, `'map'`), `int64`
  (`'bigint'`, `'number'`), for connections, calls, proxies, signal emitters and messages (`message.getBody(decode)`).
- `DBusSignedValue.signature` and `.value` on every typed value, and the contents of container type classes.

- `withContext: true` on `defineMethod`: the handler receives the caller (`context.sender`) as an extra last argument.
- `annotations` on methods, arguments, properties and signals, and `defineAnnotation` on interfaces.
- `stop({graceful: true, timeout})` on `LocalService`.
- `timeout` on `invoke` and `callTimeout` when connecting.
- `DBus.connect` and `LocalService.run` accept the handshake options (`authMethods`, `uid`) in their types.
