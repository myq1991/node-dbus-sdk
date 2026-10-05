/**
 * Errors thrown by the library. Each class sets `name` to its class name, so `error.name` identifies it as well as
 * `instanceof` does; `code` and `errno` are stable identifiers too.
 *
 * Errors returned by the remote side of a call are not these classes: they are plain `Error`s whose `name` is the
 * DBus error name (e.g. 'org.freedesktop.DBus.Error.UnknownMethod') and whose `message` is the error's text.
 */
import {DBusMessageHeader} from '../types/DBusMessageHeader'

/**
 * A method call got no reply within its timeout (InvokeOpts.timeout or the connection's callTimeout),
 * or connecting to the bus took longer than the connect options' timeout.
 */
export class TimeoutError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'TimeoutError'.
     */
    name: string = 'TimeoutError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1000

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_TIMEOUT'
}

/**
 * DBus.connect was given no address and the DBUS_SESSION_BUS_ADDRESS environment variable is not set.
 */
export class UnknownBusAddressError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'UnknownBusAddressError'.
     */
    name: string = 'UnknownBusAddressError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1001

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_UNKNOWN_BUS_ADDR'
}

/**
 * A bus address uses a transport other than unix: and tcp:.
 */
export class UnknownBusTypeError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'UnknownBusTypeError'.
     */
    name: string = 'UnknownBusTypeError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1002

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_UNKNOWN_BUS_TYPE'
}

/**
 * A named-argument call (DBusInterface.namedMethod) lacks one of the method's input arguments,
 * or a unix: bus address has neither path= nor socket=.
 */
export class NotEnoughParamsError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'NotEnoughParamsError'.
     */
    name: string = 'NotEnoughParamsError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1003

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_NOT_ENOUGH_PARAMS'
}

/**
 * None of the addresses in a bus address list could be connected to.
 */
export class CreateStreamFailedError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'CreateStreamFailedError'.
     */
    name: string = 'CreateStreamFailedError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1004

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_CREATE_STREAM'
}

/**
 * DBUS_COOKIE_SHA1 authentication refused the keyring: ~/.dbus-keyrings is writable by others or owned by
 * another user, or holds no matching cookie.
 */
export class UserPermissionError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'UserPermissionError'.
     */
    name: string = 'UserPermissionError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1005

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_PERM'
}

/**
 * Authentication with the bus failed: the server rejected every mechanism tried, or an unsupported one was asked for.
 */
export class AuthError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'AuthError'.
     */
    name: string = 'AuthError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1006

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_AUTH'
}

/**
 * A signature is invalid (see the structural rules in the DBus specification), or values do not match it,
 * e.g. two values for a one-type signature.
 */
export class SignatureError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'SignatureError'.
     */
    name: string = 'SignatureError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1007

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_SIGNATURE'
}

/**
 * A message was written without a serial number.
 */
export class SerialError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'SerialError'.
     */
    name: string = 'SerialError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1008

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_SERIAL'
}

/**
 * A value for type 'o' is not a valid object path.
 */
export class ObjectPathError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'ObjectPathError'.
     */
    name: string = 'ObjectPathError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1009

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_OBJECT_PATH'
}

/**
 * Received data ends inside the padding a value is aligned with; the message is truncated or malformed.
 */
export class AlignmentError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'AlignmentError'.
     */
    name: string = 'AlignmentError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1010

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_ALIGNMENT'
}

/**
 * Received data ends before a value it announces; the message is truncated or malformed.
 */
export class ReadBufferError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'ReadBufferError'.
     */
    name: string = 'ReadBufferError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1011

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_READ_BUFFER'
}

/**
 * A value does not fit its DBus type (an integer out of range, a string with NUL, a non-boolean for 'b', no type
 * can be inferred for a variant), or received data breaks the specification (invalid UTF-8, non-zero padding,
 * an array over 64 MiB).
 */
export class InvalidValueError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'InvalidValueError'.
     */
    name: string = 'InvalidValueError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1012

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_INVALID_VALUE'
}

/**
 * DBus.getService (and getObject/getInterface through it) was asked for a name that is neither owned on the bus
 * nor activatable, or whose activation did not give it an owner.
 */
export class ServiceNotFoundError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'ServiceNotFoundError'.
     */
    name: string = 'ServiceNotFoundError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1013

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_SERVICE_NOT_FOUND'
}

/**
 * The remote object's introspection data does not list the requested interface.
 */
export class InterfaceNotFoundError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'InterfaceNotFoundError'.
     */
    name: string = 'InterfaceNotFoundError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1015

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_INTERFACE_NOT_FOUND'
}

/**
 * A property was read or written through DBusInterface.property against its introspected access mode,
 * e.g. set() on a read-only property.
 */
export class AccessPropertyForbiddenError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'AccessPropertyForbiddenError'.
     */
    name: string = 'AccessPropertyForbiddenError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1016

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_ACCESS_PROPERTY_FORBIDDEN'
}

/**
 * LocalService.addObject was given an object whose path the service already has. Every service has '/'.
 */
export class LocalObjectPathExistsError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'LocalObjectPathExistsError'.
     */
    name: string = 'LocalObjectPathExistsError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1017

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_LOCAL_OBJECT_EXISTS'
}

/**
 * LocalObject.addInterface was given an interface whose name the object already has.
 */
export class LocalInterfaceExistsError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'LocalInterfaceExistsError'.
     */
    name: string = 'LocalInterfaceExistsError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1018

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_LOCAL_INTERFACE_EXISTS'
}

/**
 * LocalInterface.defineMethod was given a name the interface already defines.
 */
export class LocalInterfaceMethodDefinedError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'LocalInterfaceMethodDefinedError'.
     */
    name: string = 'LocalInterfaceMethodDefinedError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1019

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_LOCAL_INTERFACE_METHOD_DEFINED'
}

/**
 * LocalInterface.defineProperty was given a name the interface already defines.
 */
export class LocalInterfacePropertyDefinedError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'LocalInterfacePropertyDefinedError'.
     */
    name: string = 'LocalInterfacePropertyDefinedError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1020

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_LOCAL_INTERFACE_PROPERTY_DEFINED'
}

/**
 * LocalInterface.defineSignal was given a name the interface already defines.
 */
export class LocalInterfaceSignalDefinedError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'LocalInterfaceSignalDefinedError'.
     */
    name: string = 'LocalInterfaceSignalDefinedError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1021

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_LOCAL_INTERFACE_SIGNAL_DEFINED'
}

/**
 * A LocalService name is not a valid bus name, e.g. 'org.example.Service'.
 */
export class LocalServiceInvalidNameError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'LocalServiceInvalidNameError'.
     */
    name: string = 'LocalServiceInvalidNameError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1022

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_INVALID_LOCAL_SERVICE_NAME'
}

/**
 * A LocalObject path is not a valid object path, e.g. '/org/example/Object'.
 */
export class LocalObjectInvalidNameError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'LocalObjectInvalidNameError'.
     */
    name: string = 'LocalObjectInvalidNameError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1023

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_INVALID_LOCAL_OBJECT_NAME'
}

/**
 * A LocalInterface name is not a valid interface name, e.g. 'org.example.Interface1'.
 */
export class LocalInterfaceInvalidNameError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'LocalInterfaceInvalidNameError'.
     */
    name: string = 'LocalInterfaceInvalidNameError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1024

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_INVALID_LOCAL_INTERFACE_NAME'
}

/**
 * A method name is not a valid member name ([A-Za-z_][A-Za-z0-9_]*, at most 255 bytes).
 */
export class LocalInterfaceInvalidMethodNameError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'LocalInterfaceInvalidMethodNameError'.
     */
    name: string = 'LocalInterfaceInvalidMethodNameError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1025

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_INVALID_LOCAL_INTERFACE_METHOD_NAME'
}

/**
 * A property name is not a valid member name ([A-Za-z_][A-Za-z0-9_]*, at most 255 bytes).
 */
export class LocalInterfaceInvalidPropertyNameError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'LocalInterfaceInvalidPropertyNameError'.
     */
    name: string = 'LocalInterfaceInvalidPropertyNameError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1026

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_INVALID_LOCAL_INTERFACE_PROPERTY_NAME'
}

/**
 * A signal name is not a valid member name ([A-Za-z_][A-Za-z0-9_]*, at most 255 bytes).
 */
export class LocalInterfaceInvalidSignalNameError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'LocalInterfaceInvalidSignalNameError'.
     */
    name: string = 'LocalInterfaceInvalidSignalNameError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1027

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_INVALID_LOCAL_INTERFACE_SIGNAL_NAME'
}

/**
 * An annotation name does not have the form of an interface name, or its value is not a string.
 */
export class LocalInterfaceInvalidAnnotationError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'LocalInterfaceInvalidAnnotationError'.
     */
    name: string = 'LocalInterfaceInvalidAnnotationError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1029

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_INVALID_LOCAL_INTERFACE_ANNOTATION'
}

/**
 * A received message could not be decoded or breaks the specification (e.g. a missing required header field).
 * Emitted as 'connectionError' on the DBus instance; when the message was a reply, the call it answers is rejected
 * with it; when it was a method call, the caller gets an org.freedesktop.DBus.Error.InvalidArgs reply. When the
 * fixed part of a header cannot be trusted (an invalid byte order mark, a protocol version other than 1, or a
 * declared size over 128 MiB), the connection is closed as well.
 */
export class MessageDecodeError extends Error implements NodeJS.ErrnoException {
    /**
     * The class name, 'MessageDecodeError'.
     */
    name: string = 'MessageDecodeError'

    /**
     * Numeric code of this error class, unique within the library.
     */
    errno: number = 1028

    /**
     * String code of this error class, unique within the library.
     */
    code: string = 'E_MESSAGE_DECODE'

    /**
     * The message header, when it could be decoded and only the body could not. It identifies the message,
     * e.g. which call a reply belongs to (replySerial).
     */
    header?: Partial<DBusMessageHeader>

    /**
     * @param message - What could not be decoded.
     * @param header - The message header, if it was decoded.
     * @param options - `cause`: the error the decoder threw.
     */
    constructor(message: string, header?: Partial<DBusMessageHeader>, options?: { cause?: unknown }) {
        super(message, options)
        this.header = header
    }
}
