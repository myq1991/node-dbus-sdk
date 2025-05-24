import {DBusServiceOpts} from './DBusServiceOpts'
import {DBusService} from '../DBusService'

/**
 * Interface defining options for a DBus object.
 * Extends DBusServiceOpts to include additional properties specific to an object within a DBus service.
 */
export interface DBusObjectOpts extends DBusServiceOpts {
    /**
     * The object path of the DBus object.
     * This is a string representing the path to the object on the bus (e.g., '/org/freedesktop/DBus').
     */
    readonly objectPath: string

    /**
     * The DBusService instance to which this object belongs.
     * This links the object to a specific service on the bus.
     */
    readonly dbusService: DBusService
}
