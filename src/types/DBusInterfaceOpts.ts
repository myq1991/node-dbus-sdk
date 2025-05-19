import {DBusObjectOpts} from './DBusObjectOpts'
import {DBusObject} from '../DBusObject'
import {IntrospectInterface} from './IntrospectInterface'

export interface DBusInterfaceOpts extends DBusObjectOpts {
    readonly iface: string
    readonly dbusObject: DBusObject
    readonly introspectInterface: IntrospectInterface
}