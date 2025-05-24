/**
 * Interface defining basic information about a DBus bus name.
 */
export interface BusNameBasicInfo {
    /**
     * The well-known name or unique name of the bus connection.
     * This is the primary identifier for the service on the bus (e.g., 'org.freedesktop.DBus').
     */
    name: string

    /**
     * The unique name assigned to the connection by the bus.
     * This is typically a string like ':1.42' and is only set for active connections.
     * If not available, it may be undefined.
     */
    uniqueName?: string

    /**
     * Indicates whether the bus name is currently active.
     * True if the name is owned by an active connection, false otherwise.
     */
    active: boolean

    /**
     * Indicates whether the bus name can be activated.
     * True if the name is associated with a service that can be started automatically by the bus.
     */
    activatable: boolean

    /**
     * The process ID (PID) of the process owning the bus name.
     * This is only available for active connections and may be undefined if not available or applicable.
     */
    pid?: number
}
