/**
 * Interface defining options for emitting a DBus signal.
 * Used to specify the metadata and content of a signal to be sent over the DBus.
 */
export interface EmitSignalOpts {
    /**
     * The object path associated with the signal.
     * This specifies the path of the object emitting the signal (e.g., '/org/freedesktop/DBus').
     */
    objectPath: string

    /**
     * The interface name associated with the signal.
     * This identifies the interface that defines the signal (e.g., 'org.freedesktop.DBus.Properties').
     */
    interface: string

    /**
     * The name of the signal to emit.
     * This is the specific signal identifier (e.g., 'PropertiesChanged').
     */
    signal: string

    /**
     * The optional type signature of the signal's data.
     * This is a string describing the types of the data arguments (e.g., 'sai' for string, array of integers).
     * If not provided, it may be inferred or default to an empty signature.
     */
    signature?: string

    /**
     * The optional destination for the signal.
     * This specifies the unique name or service name of the intended recipient (e.g., ':1.42').
     * If not provided, the signal is broadcast to all listeners on the bus.
     */
    destination?: string

    /**
     * The optional data payload for the signal.
     * This is an array of values to be sent with the signal, matching the signature if provided.
     */
    data?: any[]
}
