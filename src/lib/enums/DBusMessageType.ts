/**
 * The type of a message, the second byte of its header.
 */
export enum DBusMessageType {
    /**
     * A method call.
     */
    METHOD_CALL = 1,
    /**
     * A successful reply to a method call.
     */
    METHOD_RETURN = 2,
    /**
     * An error reply to a method call.
     */
    ERROR = 3,
    /**
     * A signal.
     */
    SIGNAL = 4
}