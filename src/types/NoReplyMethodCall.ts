/**
 * A method of DBusInterface.noReplyMethod: takes the input arguments in order and sends the call with
 * NO_REPLY_EXPECTED. It returns immediately; any result or error of the call is never seen.
 */
export type NoReplyMethodCall = (...args: any[]) => void
