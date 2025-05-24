// Core DBus Classes
/**
 * Exports the main DBus class for interacting with a DBus connection.
 * Provides functionality for connecting to DBus, invoking methods, handling signals, and managing services.
 */
export {DBus} from './DBus'

/**
 * Exports the DBusInterface class representing a DBus interface.
 * Allows interaction with specific interfaces on DBus objects for method calls and property access.
 */
export {DBusInterface} from './DBusInterface'

/**
 * Exports the DBusObject class representing a DBus object.
 * Provides access to interfaces and manages object-specific operations under a service.
 */
export {DBusObject} from './DBusObject'

/**
 * Exports the DBusService class representing a DBus service.
 * Manages interactions with a specific service on the bus, including object retrieval.
 */
export {DBusService} from './DBusService'

/**
 * Exports the LocalInterface class for defining local DBus interfaces.
 * Used to create custom interfaces for local services with methods, properties, and signals.
 */
export {LocalInterface} from './LocalInterface'

/**
 * Exports the LocalObject class for defining local DBus objects.
 * Represents a local object that can host multiple interfaces for a service.
 */
export {LocalObject} from './LocalObject'

/**
 * Exports the LocalService class for defining local DBus services.
 * Manages a local service implementation with objects and interfaces exposed on the bus.
 */
export {LocalService} from './LocalService'

// Utility and Low-Level Classes
/**
 * Exports the CreateDBusError utility function for creating DBus-specific errors.
 * Used to generate errors with DBus error names and messages for protocol compliance.
 */
export {CreateDBusError} from './lib/CreateDBusError'

/**
 * Exports the DBusBufferEncoder class for encoding data into DBus wire format.
 * Handles the binary encoding of DBus messages and data types according to the specification.
 */
export {DBusBufferEncoder} from './lib/DBusBufferEncoder'

/**
 * Exports the DBusBufferDecoder class for decoding data from DBus wire format.
 * Parses binary DBus messages into structured data and objects.
 */
export {DBusBufferDecoder} from './lib/DBusBufferDecoder'

/**
 * Exports the DBusConnection class for low-level DBus connection management.
 * Manages the underlying stream and handshake for communicating with the DBus daemon.
 */
export {DBusConnection} from './lib/DBusConnection'

/**
 * Exports the DBusMessage class for representing and encoding/decoding DBus messages.
 * Provides functionality to create, serialize, and parse DBus messages (headers and bodies).
 */
export {DBusMessage} from './lib/DBusMessage'

/**
 * Exports the DBusSignalEmitter class for handling DBus signal events.
 * Allows subscription to and emission of DBus signals for specific services and interfaces.
 */
export {DBusSignalEmitter} from './lib/DBusSignalEmitter'

/**
 * Exports the DBusSignedValue class for handling typed values in DBus messages.
 * Represents a value with a specific DBus type signature for encoding and decoding.
 */
export {DBusSignedValue} from './lib/DBusSignedValue'

/**
 * Exports the Signature class for working with DBus type signatures.
 * Provides utilities for parsing and validating DBus type signatures used in messages.
 */
export {Signature} from './lib/Signature'

/**
 * Exports all custom error classes related to DBus operations.
 * Includes errors for connection issues, authentication failures, and protocol violations.
 */
export * from './lib/Errors'

// Enums for DBus Protocol Constants
/**
 * Exports the DBusMessageEndianness enum for specifying message byte order.
 * Defines constants for little-endian (LE) and big-endian (BE) formats in DBus messages.
 */
export {DBusMessageEndianness} from './lib/enums/DBusMessageEndianness'

/**
 * Exports the DBusMessageFlags enum for message flag constants.
 * Defines flags used in DBus messages, such as whether a reply is expected.
 */
export {DBusMessageFlags} from './lib/enums/DBusMessageFlags'

/**
 * Exports the DBusMessageType enum for message type constants.
 * Defines types of DBus messages, such as method call, reply, signal, and error.
 */
export {DBusMessageType} from './lib/enums/DBusMessageType'

/**
 * Exports the DBusPropertyAccess enum for property access mode constants.
 * Defines access permissions for DBus properties (e.g., read, write, read-write).
 */
export {DBusPropertyAccess} from './lib/enums/DBusPropertyAccess'

/**
 * Exports the RequestNameFlags enum for bus name request behavior constants.
 * Defines flags for controlling behavior when requesting ownership of a bus name.
 */
export {RequestNameFlags} from './lib/enums/RequestNameFlags'

/**
 * Exports the RequestNameResultCode enum for bus name request result constants.
 * Defines result codes indicating the outcome of a bus name ownership request.
 */
export {RequestNameResultCode} from './lib/enums/RequestNameResultCode'

// Common DBus Interfaces
/**
 * Exports the IntrospectableInterface class for the standard DBus introspection interface.
 * Implements 'org.freedesktop.DBus.Introspectable' for querying object structure as XML.
 */
export {IntrospectableInterface} from './lib/common/IntrospectableInterface'

/**
 * Exports the PeerInterface class for the standard DBus peer interface.
 * Implements 'org.freedesktop.DBus.Peer' for basic peer operations like ping and machine ID retrieval.
 */
export {PeerInterface} from './lib/common/PeerInterface'

/**
 * Exports the PropertiesInterface class for the standard DBus properties interface.
 * Implements 'org.freedesktop.DBus.Properties' for getting, setting, and monitoring properties.
 */
export {PropertiesInterface} from './lib/common/PropertiesInterface'

// Type Definitions for DBus SDK
/**
 * Exports the BusAddressConnectOpts type for bus address connection options.
 * Defines options for connecting to DBus using a bus address string.
 */
export type {BusAddressConnectOpts} from './types/BusAddressConnectOpts'

/**
 * Exports the BusNameBasicInfo type for basic bus name information.
 * Defines the structure for bus name details, including name, unique name, and status.
 */
export type {BusNameBasicInfo} from './types/BusNameBasicInfo'

/**
 * Exports the ConnectOpts type for general DBus connection options.
 * Defines a union of options for connecting via stream, socket, TCP, or bus address.
 */
export type {ConnectOpts} from './types/ConnectOpts'

/**
 * Exports the CreateConnectOpts type for creating a DBus connection with handshake options.
 * Defines options for connection creation, including authentication methods.
 */
export type {CreateConnectOpts} from './types/CreateConnectOpts'

/**
 * Exports the CreateSignalEmitterOpts type for signal emitter creation options.
 * Defines options for creating a DBusSignalEmitter, such as service and interface details.
 */
export type {CreateSignalEmitterOpts} from './types/CreateSignalEmitterOpts'

/**
 * Exports the DataType and Types types for DBus data type definitions.
 * Defines structures for representing DBus data types and their signatures.
 */
export type {DataType, Types} from './types/DataType'

/**
 * Exports the DBusInterfaceOpts type for DBus interface options.
 * Defines configuration options for creating a DBusInterface instance.
 */
export type {DBusInterfaceOpts} from './types/DBusInterfaceOpts'

/**
 * Exports the DBusMessageHeader type for DBus message header structure.
 * Defines the structure of a DBus message header with fields like type and serial.
 */
export type {DBusMessageHeader} from './types/DBusMessageHeader'

/**
 * Exports the DBusObjectOpts type for DBus object options.
 * Defines configuration options for creating a DBusObject instance.
 */
export type {DBusObjectOpts} from './types/DBusObjectOpts'

/**
 * Exports the DBusServiceOpts type for DBus service options.
 * Defines configuration options for creating a DBusService instance.
 */
export type {DBusServiceOpts} from './types/DBusServiceOpts'

/**
 * Exports the DefineMethodArgumentOpts and DefineMethodOpts types for method definition.
 * Defines structures for configuring DBus method arguments and methods on local interfaces.
 */
export type {DefineMethodArgumentOpts, DefineMethodOpts} from './types/DefineMethodOpts'

/**
 * Exports the DefinePropertyOpts and emitPropertiesChangedOpts types for property operations.
 * Defines structures for configuring DBus properties and emitting property change signals.
 */
export type {DefinePropertyOpts, emitPropertiesChangedOpts} from './types/DefinePropertyOpts'

/**
 * Exports the DefineSignalOpts type for signal definition.
 * Defines structures for configuring DBus signals on local interfaces.
 */
export type {DefineSignalOpts} from './types/DefineSignalOpts'

/**
 * Exports the EmitSignalOpts type for emitting DBus signals.
 * Defines options for emitting a signal, including path, interface, and data.
 */
export type {EmitSignalOpts} from './types/EmitSignalOpts'

/**
 * Exports the GetPropertyValueOpts type for getting DBus property values.
 * Defines options for retrieving a property value from a remote object.
 */
export type {GetPropertyValueOpts} from './types/GetPropertyValueOpts'

/**
 * Exports the HandshakeOpts type for DBus connection handshake options.
 * Defines options for authentication during connection setup, such as methods and UID.
 */
export type {HandshakeOpts} from './types/HandshakeOpts'

/**
 * Exports the IntrospectInterface type for introspection data of an interface.
 * Defines the structure for introspected interface data, including methods and properties.
 */
export type {IntrospectInterface} from './types/IntrospectInterface'

/**
 * Exports the IntrospectMethod type for introspection data of a method.
 * Defines the structure for introspected method data, including arguments.
 */
export type {IntrospectMethod} from './types/IntrospectMethod'

/**
 * Exports the IntrospectMethodArgument type for introspection data of a method argument.
 * Defines the structure for introspected method argument data, such as type and direction.
 */
export type {IntrospectMethodArgument} from './types/IntrospectMethodArgument'

/**
 * Exports the IntrospectNode type for introspection data of a DBus node.
 * Defines the structure for introspected node data, representing an object hierarchy.
 */
export type {IntrospectNode} from './types/IntrospectNode'

/**
 * Exports the IntrospectProperty type for introspection data of a property.
 * Defines the structure for introspected property data, including type and access mode.
 */
export type {IntrospectProperty} from './types/IntrospectProperty'

/**
 * Exports the IntrospectSignal type for introspection data of a signal.
 * Defines the structure for introspected signal data, including arguments.
 */
export type {IntrospectSignal} from './types/IntrospectSignal'

/**
 * Exports the IntrospectSignalArgument type for introspection data of a signal argument.
 * Defines the structure for introspected signal argument data, such as type and name.
 */
export type {IntrospectSignalArgument} from './types/IntrospectSignalArgument'

/**
 * Exports the InvokeOpts type for invoking DBus methods.
 * Defines options for method invocation, including service, path, and arguments.
 */
export type {InvokeOpts} from './types/InvokeOpts'

/**
 * Exports the NoReplyModeMethodCall type for method calls without reply expectation.
 * Defines the structure for method calls that do not await a response.
 */
export type {NoReplyModeMethodCall} from './types/NoReplyModeMethodCall'

/**
 * Exports the PropertyOperation type for property access operations.
 * Defines the structure for operations on DBus properties, such as get or set.
 */
export type {PropertyOperation} from './types/PropertyOperation'

/**
 * Exports the ReplyModeMethodCall type for method calls expecting a reply.
 * Defines the structure for method calls that await a response from the remote service.
 */
export type {ReplyModeMethodCall} from './types/ReplyModeMethodCall'

/**
 * Exports the ReplyOpts type for crafting replies to DBus method calls.
 * Defines options for sending a reply, including success data or error information.
 */
export type {ReplyOpts} from './types/ReplyOpts'

/**
 * Exports the ServiceBasicInfo type for basic service information.
 * Defines the structure for service details, including name, status, and PID.
 */
export type {ServiceBasicInfo} from './types/ServiceBasicInfo'

/**
 * Exports the SetPropertyValueOpts type for setting DBus property values.
 * Defines options for updating a property value on a remote object.
 */
export type {SetPropertyValueOpts} from './types/SetPropertyValueOpts'

/**
 * Exports the SocketConnectOpts type for Unix socket connection options.
 * Defines options for connecting to DBus via a Unix socket path.
 */
export type {SocketConnectOpts} from './types/SocketConnectOpts'

/**
 * Exports the StreamConnectOpts type for stream-based connection options.
 * Defines options for connecting to DBus using a pre-existing stream.
 */
export type {StreamConnectOpts} from './types/StreamConnectOpts'

/**
 * Exports the TCPConnectOpts type for TCP connection options.
 * Defines options for connecting to DBus over TCP with host and port details.
 */
export type {TCPConnectOpts} from './types/TCPConnectOpts'
