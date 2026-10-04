/**
 * A method of DBusInterface.method: takes the input arguments in order, as plain values typed by the introspected
 * signature, and resolves with undefined when the method returns nothing, the value when it returns one, or an array
 * when it returns several. Rejects with the DBus error the service replied with (`name` is the DBus error name).
 */
export type MethodCall = (...args: any[]) => Promise<any>
