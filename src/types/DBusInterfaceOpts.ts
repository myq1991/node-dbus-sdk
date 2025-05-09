import {DBusObjectOpts} from './DBusObjectOpts'

export interface DBusInterfaceOpts extends DBusObjectOpts{
    readonly iface: string
}