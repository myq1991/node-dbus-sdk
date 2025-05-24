import {DBusMessageType} from '../lib/DBusMessageType'
import {DBusMessageFlags} from '../lib/DBusMessageFlags'

/**
 * Interface defining the structure of a DBus message header.
 * The header contains metadata about the message, such as its type, destination, and other control information.
 */
export interface DBusMessageHeader {
    /**
     * The type of the DBus message.
     * This indicates whether the message is a method call, method return, error, or signal.
     */
    type: DBusMessageType

    /**
     * Flags associated with the message.
     * These flags control behavior such as whether a reply is expected or if the message should be queued.
     */
    flags: DBusMessageFlags

    /**
     * The protocol version of the DBus message.
     * Typically set to 1 for the current DBus protocol specification.
     */
    protocolVersion: number

    /**
     * The serial number of the message.
     * A unique identifier for the message used to track replies and correlate responses.
     */
    serial: number

    /**
     * The destination service name for the message.
     * This is the name of the service or connection (e.g., 'org.freedesktop.DBus' or ':1.42') that should receive the message.
     */
    destination: string

    /**
     * The object path associated with the message.
     * This specifies the target object on the destination service (e.g., '/org/freedesktop/DBus').
     */
    path: string

    /**
     * The name of the interface associated with the message.
     * This identifies the interface containing the method or signal (e.g., 'org.freedesktop.DBus.Properties').
     */
    interfaceName: string

    /**
     * The member name of the method or signal.
     * This specifies the particular method or signal being invoked or emitted (e.g., 'Get' or 'NameOwnerChanged').
     */
    member: string

    /**
     * The signature of the message body.
     * A string describing the types of the data in the message body (e.g., 's' for a single string).
     */
    signature: string

    /**
     * The sender of the message.
     * This is the unique name of the connection sending the message (e.g., ':1.42').
     */
    sender: string

    /**
     * The serial number of the message to which this is a reply.
     * Used to correlate a reply or error message with the original request. Optional and may be undefined.
     */
    replySerial?: number

    /**
     * The name of the error, if the message type is an error.
     * This is a string identifier for the error (e.g., 'org.freedesktop.DBus.Error.UnknownMethod'). Optional and may be undefined.
     */
    errorName?: string
}
