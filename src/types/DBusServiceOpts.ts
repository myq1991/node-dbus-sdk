import {DBus} from '../DBus'

/**
 * Interface defining options for a DBus service.
 * These options are used to configure and identify a service on the DBus.
 */
export interface DBusServiceOpts {
    /**
     * The DBus instance representing the connection to the bus.
     * This is used to interact with the DBus system or session bus.
     */
    readonly dbus: DBus

    /**
     * The well-known name of the service.
     * This is a string identifier for the service on the bus (e.g., 'org.freedesktop.DBus').
     */
    readonly service: string

    /**
     * The unique name of the connection owning the service.
     * This is a string identifier for the specific connection (e.g., ':1.42') on the bus.
     */
    readonly uniqueName: string
}
