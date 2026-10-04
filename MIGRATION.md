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

## Removed

- `HandshakeOpts.simple` and `HandshakeOpts.direct`. They were never used and had no effect.
- `ObjectNotFoundError`. Nothing threw it.

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

- `withContext: true` on `defineMethod`: the handler receives the caller (`context.sender`) as an extra last argument.
- `annotations` on methods, arguments, properties and signals, and `defineAnnotation` on interfaces.
- `stop({graceful: true, timeout})` on `LocalService`.
- `timeout` on `invoke` and `callTimeout` when connecting.
- `DBus.connect` and `LocalService.run` accept the handshake options (`authMethods`, `uid`) in their types.
