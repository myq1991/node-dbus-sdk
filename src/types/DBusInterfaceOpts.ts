import {DBusObjectOpts} from './DBusObjectOpts'
import {DBusObject} from '../DBusObject'
import {IntrospectInterface} from './IntrospectInterface'

/**
 * Interface defining options for a DBus interface.
 * Extends DBusObjectOpts to include additional properties specific to an interface on a DBus object.
 */
export interface DBusInterfaceOpts extends DBusObjectOpts {
    /**
     * The name of the DBus interface.
     * This is a string identifier for the interface (e.g., 'org.freedesktop.DBus.Properties').
     */
    readonly iface: string

    /**
     * The DBusObject instance to which this interface belongs.
     * This links the interface to a specific object on the bus.
     */
    readonly dbusObject: DBusObject

    /**
     * The introspection data for this interface.
     * Contains metadata about the interface's methods, properties, and signals as per the DBus introspection format.
     */
    readonly introspectInterface: IntrospectInterface
}
