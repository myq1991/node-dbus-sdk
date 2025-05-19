import {DBus} from '../DBus'

export interface DBusServiceOpts {
    readonly dbus: DBus
    readonly service: string
    readonly uniqueId: string
}