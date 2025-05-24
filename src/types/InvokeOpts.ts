/**
 * Interface defining options for invoking a method on a DBus object.
 * Used to specify the target service, object, interface, method, and arguments for a remote method call.
 */
export interface InvokeOpts {
    /**
     * The name of the service hosting the method.
     * This is typically a well-known service name (e.g., 'org.freedesktop.DBus').
     */
    service: string

    /**
     * The object path of the DBus object containing the method.
     * This specifies the path of the target object (e.g., '/org/freedesktop/DBus').
     */
    objectPath: string

    /**
     * The interface name that defines the method.
     * This identifies the interface containing the method (e.g., 'org.freedesktop.DBus.Properties').
     */
    interface: string

    /**
     * The name of the method to invoke.
     * This is the specific method identifier (e.g., 'Get').
     */
    method: string

    /**
     * The optional type signature of the method's arguments.
     * This is a string describing the types of the arguments (e.g., 's' for string, 'i' for integer).
     * If not provided, it may be inferred or default to an empty signature.
     */
    signature?: string

    /**
     * The optional arguments to pass to the method.
     * This is an array of values matching the signature if provided.
     */
    args?: any[]
}
