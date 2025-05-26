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
 * Manages interactions with a specific service on the bus, including object retrieval and management.
 */
export {DBusService} from './DBusService'

/**
 * Exports the LocalInterface class for defining local DBus interfaces.
 * Used to create custom interfaces for local services with methods, properties, and signals.
 */
export {LocalInterface} from './LocalInterface'

/**
 * Exports the LocalObject class for defining local DBus objects.
 * Represents a local object that can host multiple interfaces within a service.
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
 * Parses binary DBus messages into structured data and objects for further processing.
 */
export {DBusBufferDecoder} from './lib/DBusBufferDecoder'

/**
 * Exports the DBusConnection class for low-level DBus connection management.
 * Manages the underlying stream and handshake process for communicating with the DBus daemon.
 */
export {DBusConnection} from './lib/DBusConnection'

/**
 * Exports the DBusMessage class for representing and encoding/decoding DBus messages.
 * Provides functionality to create, serialize, and parse DBus messages including headers and bodies.
 */
export {DBusMessage} from './lib/DBusMessage'

/**
 * Exports the DBusSignalEmitter class for handling DBus signal events.
 * Enables subscription to and emission of DBus signals for specific services and interfaces.
 */
export {DBusSignalEmitter} from './lib/DBusSignalEmitter'

/**
 * Exports the DBusSignedValue class for handling typed values in DBus messages.
 * Represents a value with a specific DBus type signature for accurate encoding and decoding.
 */
export {DBusSignedValue} from './lib/DBusSignedValue'

/**
 * Exports the Signature class for working with DBus type signatures.
 * Provides utilities for parsing and validating DBus type signatures used in message data.
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
 * Defines constants for little-endian (LE) and big-endian (BE) formats used in DBus messages.
 */
export {DBusMessageEndianness} from './lib/enums/DBusMessageEndianness'

/**
 * Exports the DBusMessageFlags enum for message flag constants.
 * Defines flags used in DBus messages, such as whether a reply is expected or not.
 */
export {DBusMessageFlags} from './lib/enums/DBusMessageFlags'

/**
 * Exports the DBusMessageType enum for message type constants.
 * Defines types of DBus messages, such as method call, method return, signal, and error.
 */
export {DBusMessageType} from './lib/enums/DBusMessageType'

/**
 * Exports the DBusPropertyAccess enum for property access mode constants.
 * Defines access permissions for DBus properties (e.g., read-only, write-only, read-write).
 */
export {DBusPropertyAccess} from './lib/enums/DBusPropertyAccess'

/**
 * Exports the RequestNameFlags enum for bus name request behavior constants.
 * Defines flags for controlling behavior when requesting ownership of a bus name (e.g., replace existing).
 */
export {RequestNameFlags} from './lib/enums/RequestNameFlags'

/**
 * Exports the RequestNameResultCode enum for bus name request result constants.
 * Defines result codes indicating the outcome of a bus name ownership request (e.g., success, already owner).
 */
export {RequestNameResultCode} from './lib/enums/RequestNameResultCode'

/**
 * Exports the DBusArray class for representing a DBus array data type.
 * Encapsulates an array of values with a specific element type signature for DBus encoding and decoding.
 */
export {DBusArray} from './lib/datatypes/DBusArray'

/**
 * Exports the DBusBoolean class for representing a DBus boolean data type.
 * Encapsulates a boolean value (true/false) for DBus encoding and decoding with signature 'b'.
 */
export {DBusBoolean} from './lib/datatypes/DBusBoolean'

/**
 * Exports the DBusByte class for representing a DBus byte data type.
 * Encapsulates an 8-bit unsigned integer (0-255) for DBus encoding and decoding with signature 'y'.
 */
export {DBusByte} from './lib/datatypes/DBusByte'

/**
 * Exports the DBusDictEntry class for representing a DBus dictionary entry data type.
 * Encapsulates a key-value pair for use in dictionaries with signature '{' for DBus encoding and decoding.
 */
export {DBusDictEntry} from './lib/datatypes/DBusDictEntry'

/**
 * Exports the DBusDouble class for representing a DBus double data type.
 * Encapsulates a 64-bit double-precision floating-point number for DBus encoding and decoding with signature 'd'.
 */
export {DBusDouble} from './lib/datatypes/DBusDouble'

/**
 * Exports the DBusInt16 class for representing a DBus 16-bit signed integer data type.
 * Encapsulates a 16-bit signed integer for DBus encoding and decoding with signature 'n'.
 */
export {DBusInt16} from './lib/datatypes/DBusInt16'

/**
 * Exports the DBusInt32 class for representing a DBus 32-bit signed integer data type.
 * Encapsulates a 32-bit signed integer for DBus encoding and decoding with signature 'i'.
 */
export {DBusInt32} from './lib/datatypes/DBusInt32'

/**
 * Exports the DBusInt64 class for representing a DBus 64-bit signed integer data type.
 * Encapsulates a 64-bit signed integer (bigint) for DBus encoding and decoding with signature 'x'.
 */
export {DBusInt64} from './lib/datatypes/DBusInt64'

/**
 * Exports the DBusObjectPath class for representing a DBus object path data type.
 * Encapsulates a string representing a DBus object path for encoding and decoding with signature 'o'.
 */
export {DBusObjectPath} from './lib/datatypes/DBusObjectPath'

/**
 * Exports the DBusSignature class for representing a DBus signature data type.
 * Encapsulates a string of type codes for DBus encoding and decoding with signature 'g'.
 */
export {DBusSignature} from './lib/datatypes/DBusSignature'

/**
 * Exports the DBusString class for representing a DBus string data type.
 * Encapsulates a UTF-8 encoded string for DBus encoding and decoding with signature 's'.
 */
export {DBusString} from './lib/datatypes/DBusString'

/**
 * Exports the DBusStruct class for representing a DBus struct data type.
 * Encapsulates a sequence of fields for DBus encoding and decoding with signature '('.
 */
export {DBusStruct} from './lib/datatypes/DBusStruct'

/**
 * Exports the DBusUint16 class for representing a DBus 16-bit unsigned integer data type.
 * Encapsulates a 16-bit unsigned integer for DBus encoding and decoding with signature 'q'.
 */
export {DBusUint16} from './lib/datatypes/DBusUint16'

/**
 * Exports the DBusUint32 class for representing a DBus 32-bit unsigned integer data type.
 * Encapsulates a 32-bit unsigned integer for DBus encoding and decoding with signature 'u'.
 */
export {DBusUint32} from './lib/datatypes/DBusUint32'

/**
 * Exports the DBusUint64 class for representing a DBus 64-bit unsigned integer data type.
 * Encapsulates a 64-bit unsigned integer (bigint) for DBus encoding and decoding with signature 't'.
 */
export {DBusUint64} from './lib/datatypes/DBusUint64'

/**
 * Exports the DBusUnixFD class for representing a DBus Unix file descriptor data type.
 * Encapsulates a file descriptor index for DBus encoding and decoding with signature 'h'.
 */
export {DBusUnixFD} from './lib/datatypes/DBusUnixFD'

/**
 * Exports the DBusVariant class for representing a DBus variant data type.
 * Encapsulates a dynamic type container with a signature and value for DBus encoding and decoding with signature 'v'.
 */
export {DBusVariant} from './lib/datatypes/DBusVariant'

// Common DBus Interfaces
/**
 * Exports the IntrospectableInterface class for the standard DBus introspection interface.
 * Implements 'org.freedesktop.DBus.Introspectable' for querying object structure and capabilities as XML data.
 */
export {IntrospectableInterface} from './lib/common/IntrospectableInterface'

/**
 * Exports the PeerInterface class for the standard DBus peer interface.
 * Implements 'org.freedesktop.DBus.Peer' for basic peer operations like ping and retrieving machine ID.
 */
export {PeerInterface} from './lib/common/PeerInterface'

/**
 * Exports the ObjectManagerInterface class for the standard DBus object manager interface.
 * Implements 'org.freedesktop.DBus.ObjectManager' for managing object hierarchies and notifying
 * clients of added or removed interfaces and objects.
 */
export {ObjectManagerInterface} from './lib/common/ObjectManagerInterface'

/**
 * Exports the PropertiesInterface class for the standard DBus properties interface.
 * Implements 'org.freedesktop.DBus.Properties' for getting, setting, and monitoring property changes.
 */
export {PropertiesInterface} from './lib/common/PropertiesInterface'

// Type Definitions for DBus SDK
/**
 * Exports the BusAddressConnectOpts type for bus address connection options.
 * Defines options for connecting to DBus using a bus address string (e.g., for system or session bus).
 */
export type {BusAddressConnectOpts} from './types/BusAddressConnectOpts'

/**
 * Exports the BusNameBasicInfo type for basic bus name information.
 * Defines the structure for bus name details, including name, unique identifier, and status information.
 */
export type {BusNameBasicInfo} from './types/BusNameBasicInfo'

/**
 * Exports the ConnectOpts type for general DBus connection options.
 * Defines a union of options for connecting via stream, socket, TCP, or bus address configurations.
 */
export type {ConnectOpts} from './types/ConnectOpts'

/**
 * Exports the CreateConnectOpts type for creating a DBus connection with handshake options.
 * Defines options for connection creation, including authentication methods and parameters.
 */
export type {CreateConnectOpts} from './types/CreateConnectOpts'

/**
 * Exports the CreateSignalEmitterOpts type for signal emitter creation options.
 * Defines options for creating a DBusSignalEmitter, including service, object path, and interface details.
 */
export type {CreateSignalEmitterOpts} from './types/CreateSignalEmitterOpts'

/**
 * Exports the DataType and Types types for DBus data type definitions.
 * Defines structures for representing DBus data types and their associated signatures.
 */
export type {DataType, Types} from './types/DataType'

/**
 * Exports the DBusInterfaceOpts type for DBus interface options.
 * Defines configuration options for creating a DBusInterface instance, including connection and name details.
 */
export type {DBusInterfaceOpts} from './types/DBusInterfaceOpts'

/**
 * Exports the DBusMessageHeader type for DBus message header structure.
 * Defines the structure of a DBus message header with fields like type, flags, and serial number.
 */
export type {DBusMessageHeader} from './types/DBusMessageHeader'

/**
 * Exports the DBusObjectOpts type for DBus object options.
 * Defines configuration options for creating a DBusObject instance, including path and service details.
 */
export type {DBusObjectOpts} from './types/DBusObjectOpts'

/**
 * Exports the DBusServiceOpts type for DBus service options.
 * Defines configuration options for creating a DBusService instance, including connection and name.
 */
export type {DBusServiceOpts} from './types/DBusServiceOpts'

/**
 * Exports the DefineMethodArgumentOpts and DefineMethodOpts types for method definition.
 * Defines structures for configuring DBus method arguments and methods on local interfaces.
 */
export type {DefineMethodArgumentOpts, DefineMethodOpts} from './types/DefineMethodOpts'

/**
 * Exports the DefinePropertyOpts and emitPropertiesChangedOpts types for property operations.
 * Defines structures for configuring DBus properties and controlling property change signal emission.
 */
export type {DefinePropertyOpts, emitPropertiesChangedOpts} from './types/DefinePropertyOpts'

/**
 * Exports the DefineSignalOpts type for signal definition.
 * Defines structures for configuring DBus signals on local interfaces, including arguments and emitter.
 */
export type {DefineSignalOpts} from './types/DefineSignalOpts'

/**
 * Exports the EmitSignalOpts type for emitting DBus signals.
 * Defines options for emitting a signal, including object path, interface, signal name, and data.
 */
export type {EmitSignalOpts} from './types/EmitSignalOpts'

/**
 * Exports the GetPropertyValueOpts type for getting DBus property values.
 * Defines options for retrieving a property value from a remote object, including service and interface.
 */
export type {GetPropertyValueOpts} from './types/GetPropertyValueOpts'

/**
 * Exports the HandshakeOpts type for DBus connection handshake options.
 * Defines options for authentication during connection setup, including methods and user ID.
 */
export type {HandshakeOpts} from './types/HandshakeOpts'

/**
 * Exports the IntrospectInterface type for introspection data of an interface.
 * Defines the structure for introspected interface data, including methods, properties, and signals.
 */
export type {IntrospectInterface} from './types/IntrospectInterface'

/**
 * Exports the IntrospectMethod type for introspection data of a method.
 * Defines the structure for introspected method data, including name and arguments.
 */
export type {IntrospectMethod} from './types/IntrospectMethod'

/**
 * Exports the IntrospectMethodArgument type for introspection data of a method argument.
 * Defines the structure for introspected method argument data, including name, type, and direction.
 */
export type {IntrospectMethodArgument} from './types/IntrospectMethodArgument'

/**
 * Exports the IntrospectNode type for introspection data of a DBus node.
 * Defines the structure for introspected node data, representing an object hierarchy with child nodes.
 */
export type {IntrospectNode} from './types/IntrospectNode'

/**
 * Exports the IntrospectProperty type for introspection data of a property.
 * Defines the structure for introspected property data, including name, type, and access permissions.
 */
export type {IntrospectProperty} from './types/IntrospectProperty'

/**
 * Exports the IntrospectSignal type for introspection data of a signal.
 * Defines the structure for introspected signal data, including name and arguments.
 */
export type {IntrospectSignal} from './types/IntrospectSignal'

/**
 * Exports the IntrospectSignalArgument type for introspection data of a signal argument.
 * Defines the structure for introspected signal argument data, including name and type.
 */
export type {IntrospectSignalArgument} from './types/IntrospectSignalArgument'

/**
 * Exports the InvokeOpts type for invoking DBus methods.
 * Defines options for method invocation, including service, object path, interface, method, and arguments.
 */
export type {InvokeOpts} from './types/InvokeOpts'

/**
 * Exports the NoReplyModeMethodCall type for method calls without reply expectation.
 * Defines the structure for method calls that do not await or expect a response from the remote service.
 */
export type {NoReplyModeMethodCall} from './types/NoReplyModeMethodCall'

/**
 * Exports the PropertyOperation type for property access operations.
 * Defines the structure for operations on DBus properties, such as getting or setting values.
 */
export type {PropertyOperation} from './types/PropertyOperation'

/**
 * Exports the ReplyModeMethodCall type for method calls expecting a reply.
 * Defines the structure for method calls that await a response from the remote service with return data.
 */
export type {ReplyModeMethodCall} from './types/ReplyModeMethodCall'

/**
 * Exports the ReplyOpts type for crafting replies to DBus method calls.
 * Defines options for sending a reply, including destination, serial, success data, or error information.
 */
export type {ReplyOpts} from './types/ReplyOpts'

/**
 * Exports the ServiceBasicInfo type for basic service information.
 * Defines the structure for service details, including name, status, process ID, and other metadata.
 */
export type {ServiceBasicInfo} from './types/ServiceBasicInfo'

/**
 * Exports the SetPropertyValueOpts type for setting DBus property values.
 * Defines options for updating a property value on a remote object, including service, path, and value.
 */
export type {SetPropertyValueOpts} from './types/SetPropertyValueOpts'

/**
 * Exports the SocketConnectOpts type for Unix socket connection options.
 * Defines options for connecting to DBus via a Unix socket path or abstract socket.
 */
export type {SocketConnectOpts} from './types/SocketConnectOpts'

/**
 * Exports the StreamConnectOpts type for stream-based connection options.
 * Defines options for connecting to DBus using a pre-existing readable and writable stream.
 */
export type {StreamConnectOpts} from './types/StreamConnectOpts'

/**
 * Exports the TCPConnectOpts type for TCP connection options.
 * Defines options for connecting to DBus over TCP with host, port, and family (IPv4/IPv6) details.
 */
export type {TCPConnectOpts} from './types/TCPConnectOpts'
