# NodeDBus

## Introduction

This project is a comprehensive TypeScript library for interacting with DBus, a message bus system that enables communication between processes on Linux and other Unix-like operating systems. The library provides a robust and type-safe API to connect to DBus, manage services, objects, and interfaces, invoke methods, handle signals, and define local services and interfaces for custom DBus implementations. It is designed to simplify inter-process communication (IPC) for developers by abstracting the complexities of the DBus protocol while maintaining flexibility and control.

## Core Features

### 1. **DBus Connection Management**
- **Connection Establishment**: The library supports connecting to DBus via various transport options (e.g., socket paths, TCP, or custom streams) using configurable `ConnectOpts`.
- **Initialization**: Automatically performs a `Hello` call to obtain a unique connection name from the DBus daemon and sets up event listeners for connection state changes.
- **Event-Driven**: Built on Node.js `EventEmitter`, the library emits events for connection status (`online`, `offline`, `replaced`), name ownership changes, and incoming messages.

### 2. **Method Invocation and Replies**
- **Method Calls**: Provides synchronous and asynchronous method invocation with support for signatures and argument handling. Methods can be called with or without expecting a reply (`invoke` with `noReply` option).
- **Replies**: Supports sending replies to method calls (`reply`) with both success responses (`METHOD_RETURN`) and error responses (`ERROR`).

### 3. **Signal Handling**
- **Signal Emission**: Allows broadcasting DBus signals to other processes using `emitSignal` with customizable options (e.g., object path, interface, signal name).
- **Signal Subscription**: Implements a flexible signal subscription system via `createSignalEmitter`, enabling applications to listen for specific signals with match rules dynamically added to the DBus daemon.

### 4. **Property Management**
- **Get/Set Properties**: Simplifies access to DBus properties through `getProperty` and `setProperty` methods, interfacing with the standard `org.freedesktop.DBus.Properties` interface.
- **Access Control**: Enforces property access modes (read, write, read-write) based on introspection data.

### 5. **Service and Object Management**
- **Hierarchy Structure**: Organizes DBus interactions into a hierarchy of `DBusService`, `DBusObject`, and `DBusInterface` classes, mirroring the DBus object model.
- **Introspection**: Supports dynamic introspection of remote services and objects to retrieve metadata about available interfaces, methods, properties, and signals (`introspect`, `listInterfaces`, `listObjects`).
- **Service Discovery**: Facilitates listing and accessing DBus services and their objects (`getObjects`, `getInterface`).

### 6. **Local Service Implementation**
- **Custom Services**: Enables the creation of local DBus services with `LocalService`, allowing developers to define and expose their own DBus objects and interfaces.
- **Interface Definition**: Provides `LocalInterface` for defining custom methods, properties, and signals with strict validation of DBus naming conventions.
- **Object Management**: Manages local objects via `LocalObject`, supporting introspection and standard interfaces like `org.freedesktop.DBus.Properties` and `org.freedesktop.DBus.Introspectable`.
- **Method Call Handling**: Routes incoming method calls to the appropriate local interface and method, returning formatted replies or errors.

### 7. **Error Handling and Validation**
- **Custom Errors**: Implements DBus-specific error types (e.g., `ServiceNotFoundError`, `InterfaceNotFoundError`) and validates names for services, interfaces, methods, properties, and signals.
- **Signature Matching**: Ensures compatibility of argument signatures during method calls and property operations to prevent runtime errors.

## Key Components

- **DBus**: The main class for managing DBus connections, method calls, signals, and events. It serves as the entry point for interacting with the DBus daemon.
- **DBusService**: Represents a DBus service, providing methods to list and access its objects.
- **DBusObject**: Encapsulates a DBus object, allowing introspection and interface retrieval.
- **DBusInterface**: Provides access to methods, properties, and signals of a specific DBus interface with type-safe operations.
- **LocalService**: Manages a custom DBus service, handling incoming method calls and integrating with the DBus bus.
- **LocalObject**: Represents a local DBus object, associating interfaces and supporting introspection.
- **LocalInterface**: Defines custom DBus interfaces with methods, properties, and signals for local service implementation.

## Quick Start Guide

Below are two practical examples to help you quickly get started with this DBus library. The first example demonstrates how to expose a custom DBus service, and the second shows how to connect to and interact with a DBus service.

### Example 1: Exposing a Custom DBus Service

This example shows how to create and run a local DBus service with a custom interface, method, property, and signal.

```typescript
import { LocalService, LocalInterface, LocalObject } from 'nodedbus';
import EventEmitter from 'node:events';

async function runExposeService(): Promise<void> {
    // Initialize a local service with a unique name
    const service = new LocalService('org.test.service');
    
    // Create a local object at the root path
    const object = new LocalObject('/');
    
    // Define a custom interface
    const interface = new LocalInterface('test.iface');
    
    // Define a property with getter and setter
    let testProp: string = 'you';
    interface.defineProperty({
        name: 'testProp',
        type: 'av', // Array of variants
        emitPropertiesChanged: { emitValue: true },
        getter: () => testProp,
        setter: (value: string) => { testProp = value; }
    });
    
    // Define a method with input and output arguments
    interface.defineMethod({
        name: 'test',
        inputArgs: [{ type: 'u' }], // Unsigned integer input
        outputArgs: [{ type: 'v' }], // Variant output
        method: (name: number = 1234) => {
            console.log('name:', name);
            return { name, haha: true, sleep: 'oh!' };
        }
    });
    
    // Define a signal with an event emitter
    const eventEmitter = new EventEmitter();
    interface.defineSignal({
        name: 'testSignal',
        args: [{ name: 'timestamp', type: 's' }], // String argument
        eventEmitter
    });
    
    // Associate the interface with the object and the object with the service
    object.addInterface(interface);
    service.addObject(object);
    
    // Connect to a DBus bus and run the service (adjust the bus address as needed)
    await service.run({ busAddress: 'tcp:host=192.168.1.236,port=44444' });
    
    // Optionally emit a signal periodically
    // setInterval(() => {
    //     eventEmitter.emit('testSignal', `${Date.now()}`);
    // }, 3000);
}

// Run the service
runExposeService().catch(console.error);
```

### Example 2: Connecting to and Interacting with a DBus Service

This example demonstrates how to connect to a DBus bus, access a service, and interact with its objects, properties, and signals.

```typescript
import { DBus } from 'nodedbus';

async function runClient(): Promise<void> {
    // Connect to a DBus bus (adjust the bus address as needed)
    const dbus = await DBus.connect({ busAddress: 'tcp:host=192.168.1.236,port=44444' });
    console.log('Connected to DBus successfully');
    
    // Access a specific service
    const service = await dbus.getService('org.test.service');
    
    // Get an object from the service
    const object = await service.getObject('/');
    
    // Access the custom interface and properties interface
    const customInterface = await object.getInterface('test.iface');
    const propertiesInterface = await object.getInterface('org.freedesktop.DBus.Properties');
    
    // Listen for property change signals
    propertiesInterface.signal.on('PropertiesChanged', console.log);
    
    // Set and get a property value
    await customInterface.property.testProp.set([12345678]);
    console.log(await customInterface.property.testProp.get());
    console.log('Property value set successfully');
    
    // Periodically read the property value
    setInterval(async () => {
        try {
            console.log(await customInterface.property.testProp.get());
        } catch (e: any) {
            console.log(e.message);
        }
    }, 3000);
}

// Run the client
runClient().catch(console.error);
```

## Usage

The library is designed for both consuming existing DBus services and creating new ones. Developers can connect to a DBus bus, interact with remote services by invoking methods or listening to signals, and define local services to expose functionality to other processes. Its modular design and type safety make it suitable for complex IPC scenarios in Node.js applications.

## Conclusion

This DBus library provides a powerful and flexible solution for inter-process communication in TypeScript/Node.js environments. By abstracting low-level DBus protocol details and offering a structured, object-oriented API, it enables developers to build robust DBus clients and services with ease, supporting both standard operations and custom implementations.