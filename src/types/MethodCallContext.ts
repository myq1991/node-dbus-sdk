import {DBusMessage} from '../lib/DBusMessage'

/**
 * Information about the call a method handler is answering, passed to handlers defined with `withContext: true`.
 * Typically used for access control, e.g. asking polkit whether `sender` may perform the action.
 */
export interface MethodCallContext {
    /**
     * Unique bus name of the caller (e.g. ':1.42'), as stamped on the message by the bus.
     */
    sender: string

    /**
     * Object path the method was called on.
     */
    objectPath: string

    /**
     * Interface the method belongs to.
     */
    interface: string

    /**
     * Name of the called method.
     */
    method: string

    /**
     * The method call message itself, for anything else in its header.
     */
    message: DBusMessage
}
