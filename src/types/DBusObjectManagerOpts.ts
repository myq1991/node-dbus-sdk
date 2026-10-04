import {DBus} from '../DBus'
import {DecodeOpts} from './DecodeOpts'

/**
 * What a DBusObjectManager is created with, by DBus.getObjectManager.
 */
export interface DBusObjectManagerOpts {
    /**
     * The connection.
     */
    dbus: DBus

    /**
     * The service's well-known name.
     */
    service: string

    /**
     * The unique name of the service's current owner.
     */
    uniqueName: string

    /**
     * Path of the object implementing org.freedesktop.DBus.ObjectManager.
     */
    objectPath: string

    /**
     * How property values are given, overriding the connection's DecodeOpts.
     */
    decode?: DecodeOpts
}
