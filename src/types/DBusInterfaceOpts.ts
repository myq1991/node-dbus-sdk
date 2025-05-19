import {DBusObjectOpts} from './DBusObjectOpts'
import {DBusObject} from '../DBusObject'

export interface DBusInterfaceOpts extends DBusObjectOpts {
    readonly iface: string
    readonly dbusObject: DBusObject
}