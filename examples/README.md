# Examples

Each file is a complete program that imports `dbus-sdk` the way your code would. They connect to the session bus
(`DBUS_SESSION_BUS_ADDRESS`), so on a Linux desktop they run as they are.

| File | Shows |
|---|---|
| [01-bus-basics.ts](01-bus-basics.ts) | Connecting, the bus's own methods, calling a method through a proxy and with `invoke` |
| [02-greeter-service.ts](02-greeter-service.ts) | A service: methods (several outputs, async, errors, caller context), read-write and read-only properties, a signal, annotations, graceful stop |
| [03-greeter-client.ts](03-greeter-client.ts) | Its client: positional and named arguments, return values, DBus errors, timeouts, properties, signals, `PropertiesChanged` |
| [04-signals.ts](04-signals.ts) | Emitting signals, subscribing with match rules (`createSignalEmitter`), `serviceOnline` / `serviceOffline` |
| [05-types.ts](05-types.ts) | How each DBus type maps to JavaScript and back, variant type inference, explicit types with `DBusSignedValue` and type classes, validation errors |
| [06-object-manager.ts](06-object-manager.ts) | `org.freedesktop.DBus.ObjectManager`: a service whose objects come and go and announces property changes, and a client (`getObjectManager`) that keeps a copy of them |
| [07-introspect.ts](07-introspect.ts) | Walking a service's object tree and listing every method, property and signal |

## Running them

They are TypeScript. Node.js 22.18 or later runs TypeScript files directly. On older versions, use a runner such as
`npx tsx`.

In a project that installed `dbus-sdk`, copy an example and run it:

```bash
node 01-bus-basics.ts
```

In this repository, build first. `npm run example` makes `dbus-sdk` resolve to the local build:

```bash
npm run build
npm run example -- examples/01-bus-basics.ts

# the greeter: the service in one terminal, the client in another
npm run example -- examples/02-greeter-service.ts
npm run example -- examples/03-greeter-client.ts
```

Without a session bus, for example on macOS or in a container, start one for the current shell. On macOS, install
dbus first with `brew install dbus`.

```bash
export DBUS_SESSION_BUS_ADDRESS=$(dbus-daemon --session --address=unix:tmpdir=/tmp --fork --print-address)
```

The test suite runs every example on a private bus (`src/tests/integration/Examples.test.ts`). It also type-checks
them against the published type declarations, so they stay correct as the library changes.
