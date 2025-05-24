# DBus SDK API Documentation

This document provides a detailed overview of the `dbus-sdk` library's API, designed for interacting with DBus (Desktop Bus) in Node.js environments with TypeScript support. The library enables seamless inter-process communication (IPC) on Linux and Unix-like systems by offering a robust, type-safe interface for connecting to DBus, invoking methods, handling signals, and defining custom services. Below, each class's purpose and functionality are explained, followed by how they integrate to form a cohesive system for DBus interactions.

## Table of Contents
- [Overview](#overview)
- [Class: DBus](#class-dbus)
- [Class: DBusService](#class-dbusservice)
- [Class: DBusObject](#class-dbusobject)
- [Class: DBusInterface](#class-dbusinterface)
- [Class: LocalService](#class-localservice)
- [Class: LocalObject](#class-localobject)
- [Class: LocalInterface](#class-localinterface)
- [Integration and Usage](#integration-and-usage)
- [Examples](#examples)

## Overview

`dbus-sdk` is structured around a hierarchy of classes that mirror the DBus object model, facilitating both consumption of existing DBus services and the creation of custom ones. The library handles low-level DBus protocol details (e.g., message encoding, type conversion) while providing a high-level, object-oriented API. The primary classes are divided into two categories:
- **Client-Side Classes**: `DBus`, `DBusService`, `DBusObject`, and `DBusInterface` for interacting with remote DBus services.
- **Server-Side Classes**: `LocalService`, `LocalObject`, and `LocalInterface` for defining and exposing custom DBus services.

## Class: DBus

### Purpose
The `DBus` class is the central entry point for all DBus interactions. It manages the connection to a DBus bus (system or session), handles low-level communication with the DBus daemon, and provides methods for invoking remote methods, emitting signals, and managing services and signal subscriptions. Extending `EventEmitter`, it supports an event-driven approach to handle connection status changes and incoming messages.

### Key Properties
- **`uniqueName`**: A string representing the unique name assigned by the DBus daemon (e.g., `:1.123`) after connection initialization.

### Key Methods
- **`static async connect(opts: ConnectOpts): Promise<DBus>`**: Establishes a connection to a DBus bus using provided options (e.g., socket path, TCP details). Returns an initialized `DBus` instance.
- **`async invoke(opts: InvokeOpts, noReply?: boolean): Promise<any[]> | void`**: Invokes a remote DBus method. Supports both reply-expected (returns a Promise with response data) and no-reply modes (returns void).
- **`async getProperty(opts: GetPropertyValueOpts): Promise<any>`**: Retrieves a property value from a remote DBus object using the `org.freedesktop.DBus.Properties` interface.
- **`async setProperty(opts: SetPropertyValueOpts): Promise<void>`**: Sets a property value on a remote DBus object using the `org.freedesktop.DBus.Properties` interface.
- **`emitSignal(opts: EmitSignalOpts): void`**: Broadcasts a DBus signal to other processes with specified options (e.g., object path, interface, signal name).
- **`reply(opts: ReplyOpts): void`**: Sends a reply to a method call, supporting both success (`METHOD_RETURN`) and error (`ERROR`) responses.
- **`createSignalEmitter(opts: CreateSignalEmitterOpts): DBusSignalEmitter`**: Creates a signal emitter for subscribing to specific DBus signals based on service, object path, and interface.
- **`on(eventName: string, listener: Function): this`**: Registers event listeners for various DBus events (e.g., `online`, `offline`, `NameOwnerChanged`) related to service status and connection state.

### Events
- **`online(name: string)`**: Emitted when a service becomes available.
- **`offline(name: string)`**: Emitted when a service goes offline.
- **`replaced(name: string)`**: Emitted when a service's owner changes.
- **`NameOwnerChanged(name: string, oldOwner: string, newOwner: string)`**: Emitted when a service's ownership changes.
- **`connectionClose()`**: Emitted when the DBus connection is closed.
- **`connectionError(error: Error)`**: Emitted when a connection error occurs.
- **`methodCall(message: DBusMessage)`**: Emitted for incoming method calls (used internally for local service handling).

## Class: DBusService

### Purpose
The `DBusService` class represents a remote DBus service identified by a well-known name (e.g., `org.freedesktop.NetworkManager`). It provides methods to discover and access the service's objects, facilitating interaction with the service's structure.

### Key Properties
- **`name: string`**: The well-known name of the service.
- **`uniqueName: string`**: The unique name of the current owner of the service (e.g., `:1.123`), which may change if ownership changes.

### Key Methods
- **`async listObjects(): Promise<string[]>`**: Retrieves a list of object paths available under this service by recursively introspecting the object hierarchy.
- **`async getObjects(): Promise<DBusObject[]>`**: Returns an array of `DBusObject` instances for all object paths under this service.
- **`async getObject(objectPath: string): Promise<DBusObject>`**: Retrieves a specific `DBusObject` instance for the given object path.

## Class: DBusObject

### Purpose
The `DBusObject` class encapsulates a specific object within a DBus service, identified by an object path (e.g., `/org/freedesktop/NetworkManager`). It enables introspection of the object's structure and provides access to its interfaces.

### Key Properties
- **`name: string`**: The object path of this DBus object.

### Key Methods
- **`async introspect(): Promise<IntrospectNode>`**: Performs introspection on the object to retrieve metadata about its interfaces, methods, properties, and signals as an XML-parsed structure.
- **`async listInterfaces(): Promise<string[]>`**: Returns a list of interface names available on this object.
- **`async getInterfaces(): Promise<DBusInterface[]>`**: Retrieves all `DBusInterface` instances for the interfaces on this object.
- **`async getInterface(iface: string): Promise<DBusInterface>`**: Returns a specific `DBusInterface` instance for the given interface name.

## Class: DBusInterface

### Purpose
The `DBusInterface` class provides access to the methods, properties, and signals of a specific interface on a DBus object (e.g., `org.freedesktop.NetworkManager`). It offers type-safe operations based on introspection data.

### Key Properties
- **`name: string`**: The name of the interface (e.g., `org.freedesktop.NetworkManager`).
- **`method: Record<string, ReplyModeMethodCall>`**: A dynamically generated object mapping method names to callable functions that expect a reply.
- **`noReplyMethod: Record<string, NoReplyModeMethodCall>`**: A dynamically generated object mapping method names to callable functions that do not expect a reply.
- **`property: Record<string, PropertyOperation>`**: A dynamically generated object mapping property names to get/set operations with access control.
- **`signal: DBusSignalEmitter`**: A lazily initialized signal emitter for subscribing to signals on this interface.

### Key Methods
- **`listMethods(): IntrospectMethod[]`**: Returns an array of method metadata from introspection data.
- **`listProperties(): IntrospectProperty[]`**: Returns an array of property metadata from introspection data.
- **`listSignals(): IntrospectSignal[]`**: Returns an array of signal metadata from introspection data.

## Class: LocalService

### Purpose
The `LocalService` class enables the creation and management of a custom DBus service that can be exposed to other processes. It handles incoming method calls, manages associated objects, and connects to a DBus bus to publish the service.

### Key Properties
- **`name: string`**: The well-known name of the local service (e.g., `org.test.service`).

### Key Methods
- **`async run(opts: ConnectOpts): Promise<void>`**: Connects to a DBus bus using the provided options and starts the service, listening for incoming method calls.
- **`async stop(): Promise<void>`**: Stops the service by releasing the name and disconnecting from the DBus bus.
- **`addObject(localObject: LocalObject): boolean`**: Adds a `LocalObject` to the service, associating it with the service's context.
- **`removeObject(inp: LocalObject | string): boolean`**: Removes a `LocalObject` by instance or object path.
- **`listObjects(): Record<string, LocalObject>`**: Returns a record of all objects associated with this service.
- **`findObjectByPath<T extends LocalObject>(objectPath: string): T | undefined`**: Finds a `LocalObject` by its path.
- **`listObjectPaths(): string[]`**: Returns an array of object paths for all objects in this service.

## Class: LocalObject

### Purpose
The `LocalObject` class represents a custom DBus object within a local service, identified by an object path (e.g., `/`). It manages associated interfaces and supports standard DBus interfaces like `org.freedesktop.DBus.Properties` for property management.

### Key Properties
- **`name: string`**: The object path of this local object.
- **`propertiesInterface: PropertiesInterface`**: Access to the standard properties interface for handling property-related operations.
- **`introspectableInterface: IntrospectableInterface`**: Access to the standard introspectable interface for introspection operations.
- **`peerInterface: PeerInterface`**: Access to the standard peer interface for peer-related operations.

### Key Methods
- **`addInterface(localInterface: LocalInterface): boolean`**: Adds a `LocalInterface` to this object, associating it with the object's context.
- **`removeInterface(inp: LocalInterface | string): boolean`**: Removes a `LocalInterface` by instance or name.
- **`listInterfaces(): Record<string, LocalInterface>`**: Returns a record of all interfaces associated with this object.
- **`findInterfaceByName<T extends LocalInterface>(name: string): T | undefined`**: Finds a `LocalInterface` by its name.
- **`introspectNode: IntrospectNode`**: Getter for introspection data of this object, including all associated interfaces.

## Class: LocalInterface

### Purpose
The `LocalInterface` class allows developers to define a custom DBus interface with methods, properties, and signals that can be exposed through a local service. It handles incoming method calls and property operations, and emits signals as configured.

### Key Properties
- **`name: string`**: The name of the local interface (e.g., `org.test.iface`).
- **`introspectInterface: IntrospectInterface`**: Getter for introspection data of this interface, including defined methods, properties, and signals.

### Key Methods
- **`defineMethod(opts: DefineMethodOpts): this`**: Defines a custom method with input/output signatures and an implementation.
- **`removeMethod(name: string): this`**: Removes a defined method by name.
- **`defineProperty(opts: DefinePropertyOpts): this`**: Defines a custom property with type, access mode (read/write), and getter/setter functions.
- **`removeProperty(name: string): this`**: Removes a defined property by name.
- **`defineSignal(opts: DefineSignalOpts): this`**: Defines a custom signal with arguments and an associated `EventEmitter` for triggering.
- **`removeSignal(name: string): this`**: Removes a defined signal by name.
- **`async callMethod(name: string, payloadSignature: string | undefined, ...args: any[]): Promise<{signature?: string, result: any}>`**: Calls a defined method with validated arguments and returns the result.
- **`async setProperty(name: string, value: any): Promise<void>`**: Sets a property value if the property is writable.
- **`async getProperty(name: string): Promise<any>`**: Gets a property value if the property is readable.
- **`methodNames(): string[]`**: Lists names of defined methods.
- **`propertyNames(): string[]`**: Lists names of defined properties.
- **`signalNames(): string[]`**: Lists names of defined signals.

## Integration and Usage

The classes in `dbus-sdk` are designed to work together in a hierarchical and modular fashion, reflecting the DBus object model. Below is an explanation of how they integrate for common use cases.

### Client-Side Interaction (Consuming Remote Services)
1. **Connecting to DBus**: Start with `DBus.connect()` to establish a connection to a DBus bus (system or session). This returns a `DBus` instance, which is the entry point for all interactions.
2. **Accessing Services**: Use `DBus` to obtain a `DBusService` instance for a specific service (e.g., `org.freedesktop.NetworkManager`). The `DBusService` class allows discovery of objects under that service.
3. **Exploring Objects**: From a `DBusService`, retrieve `DBusObject` instances for specific object paths (e.g., `/org/freedesktop/NetworkManager`). Use `DBusObject` to introspect the object's structure and access its interfaces.
4. **Interacting with Interfaces**: Use `DBusObject` to get `DBusInterface` instances for specific interfaces on the object. With `DBusInterface`, you can invoke methods (`method` or `noReplyMethod`), access properties (`property`), and subscribe to signals (`signal`).
5. **Handling Events**: Leverage `DBus` event listeners (e.g., `on('online', ...)` or signal emitters created via `createSignalEmitter`) to react to service availability changes or incoming signals.

### Server-Side Implementation (Exposing Custom Services)
1. **Defining a Service**: Create a `LocalService` instance with a unique service name (e.g., `org.test.service`). This class manages the custom service and connects to a DBus bus.
2. **Creating Objects**: Define `LocalObject` instances for specific object paths (e.g., `/`) and add them to the `LocalService`. Each `LocalObject` represents a node in the service's object hierarchy.
3. **Defining Interfaces**: Create `LocalInterface` instances with custom methods, properties, and signals using `defineMethod`, `defineProperty`, and `defineSignal`. Add these interfaces to `LocalObject` instances.
4. **Running the Service**: Call `LocalService.run()` to connect to the DBus bus and publish the service. The library automatically handles incoming method calls, routing them to the appropriate `LocalInterface` methods or properties.
5. **Emitting Signals**: Use `EventEmitter` instances associated with signals in `LocalInterface` to trigger signal emissions, which are broadcast to subscribed clients via the `DBus` instance.

### Type Safety and Data Handling
- The library handles type conversion between DBus's strict type system and TypeScript/JavaScript using `DBusSignedValue`, ensuring signature validation and proper serialization/deserialization.
- Introspection data (`IntrospectNode`, `IntrospectInterface`, etc.) dynamically informs method calls and property access, enforcing access control and type compatibility.

## Examples

### Example 1: Interacting with a Remote DBus Service
This example demonstrates connecting to a remote DBus service, accessing an object, invoking a method, and listening for signals.

```typescript
import { DBus } from 'dbus-sdk';

async function interactWithRemoteService(): Promise<void> {
    try {
        // Connect to a DBus bus (adjust bus address as needed)
        const dbus = await DBus.connect({ busAddress: 'tcp:host=192.168.1.236,port=44444' });
        console.log('Connected to DBus successfully');

        // Access a specific service
        const service = await dbus.getService('org.test.service13');

        // Get an object from the service
        const object = await service.getObject('/');

        // Access a specific interface
        const customInterface = await object.getInterface('test.iface');
        const propertiesInterface = await object.getInterface('org.freedesktop.DBus.Properties');

        // Listen for property change signals
        propertiesInterface.signal.on('PropertiesChanged', console.log);

        // Get and set a property value
        const propValue = await customInterface.property.testProp.get();
        console.log('Current property value:', propValue);
        await customInterface.property.testProp.set([12345678]);
        console.log('Property value updated');

        // Invoke a method
        const result = await customInterface.method.test(123);
        console.log('Method result:', result);
    } catch (error) {
        console.error('Error interacting with service:', error);
    }
}

interactWithRemoteService();
```

### Example 2: Exposing a Custom DBus Service
This example shows how to define and run a custom DBus service with a local interface, method, property, and signal.

```typescript
import { LocalService, LocalInterface, LocalObject } from 'dbus-sdk';
import EventEmitter from 'node:events';

async function runCustomService(): Promise<void> {
    try {
        // Initialize a local service with a unique name
        const service = new LocalService('org.test.service13');

        // Create a local object at the root path
        const object = new LocalObject('/');

        // Define a custom interface
        const iface = new LocalInterface('test.iface');

        // Define a property with getter and setter
        let testProp = 'initial';
        iface.defineProperty({
            name: 'testProp',
            type: 'av', // Array of variants
            emitPropertiesChanged: { emitValue: true },
            getter: () => testProp,
            setter: (value: string) => { testProp = value; }
        });

        // Define a method with input and output arguments
        iface.defineMethod({
            name: 'test',
            inputArgs: [{ type: 'u' }], // Unsigned integer input
            outputArgs: [{ type: 'v' }], // Variant output
            method: (name: number = 1234) => {
                console.log('Method called with name:', name);
                return { name, haha: true, sleep: 'oh!' };
            }
        });

        // Define a signal with an event emitter
        const eventEmitter = new EventEmitter();
        iface.defineSignal({
            name: 'testSignal',
            args: [{ name: 'timestamp', type: 's' }], // String argument
            eventEmitter
        });

        // Associate the interface with the object and the object with the service
        object.addInterface(iface);
        service.addObject(object);

        // Connect to a DBus bus and run the service
        await service.run({ busAddress: 'tcp:host=192.168.1.236,port=44444' });
        console.log('Custom DBus service is running...');

        // Periodically emit a signal (optional)
        setInterval(() => {
            eventEmitter.emit('testSignal', `${Date.now()}`);
        }, 3000);
    } catch (error) {
        console.error('Failed to run custom service:', error);
    }
}

runCustomService();
```

## Conclusion

The `dbus-sdk` library provides a comprehensive, type-safe API for DBus interactions in Node.js and TypeScript environments. Its client-side classes (`DBus`, `DBusService`, `DBusObject`, `DBusInterface`) enable seamless interaction with remote services, while server-side classes (`LocalService`, `LocalObject`, `LocalInterface`) facilitate the creation of custom services. By integrating these components, developers can build robust IPC solutions, abstracting away the complexities of the DBus protocol while retaining full control over service interactions and implementations. For further details or to contribute, visit the [GitHub repository](https://github.com/myq1991/nodedbus).