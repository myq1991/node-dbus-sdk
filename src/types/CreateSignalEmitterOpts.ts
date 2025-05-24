/**
 * Interface defining options for creating a DBus signal emitter.
 * These options specify the scope of the signals to be emitted or listened to on the DBus.
 */
export interface CreateSignalEmitterOpts {
    /**
     * The name of the service to associate with the signal emitter.
     * This is typically a well-known service name (e.g., 'org.freedesktop.DBus').
     */
    service: string

    /**
     * The unique name of the connection on the bus.
     * This can be a specific unique name (e.g., ':1.42') or '*' to match any unique name.
     */
    uniqueName: string | '*'

    /**
     * The object path to associate with the signal emitter.
     * This can be a specific path (e.g., '/org/freedesktop/DBus') or '*' to match any object path.
     */
    objectPath: string | '*'

    /**
     * The interface name to associate with the signal emitter.
     * This can be a specific interface (e.g., 'org.freedesktop.DBus') or '*' to match any interface.
     */
    interface: string | '*'
}
