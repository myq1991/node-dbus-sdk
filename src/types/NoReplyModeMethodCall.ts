/**
 * Type definition for a method call function that operates in no-reply mode.
 * Used to represent a DBus method call that does not expect or return a response from the server.
 */
export type NoReplyModeMethodCall = (...args: any[]) => void
