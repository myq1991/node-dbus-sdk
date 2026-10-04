/**
 * A method of DBusInterface.namedNoReplyMethod: takes the input arguments as one object keyed by the introspected
 * argument names and sends the call without waiting for a reply.
 */
export type NamedNoReplyMethodCall = (parameterObject?: Record<string, any>) => void