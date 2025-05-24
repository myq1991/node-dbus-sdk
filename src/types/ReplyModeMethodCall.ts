/**
 * Type definition for a method call function that operates in reply mode.
 * Used to represent a DBus method call that expects and returns a response from the server.
 */
export type ReplyModeMethodCall = (...args: any[]) => Promise<any>
