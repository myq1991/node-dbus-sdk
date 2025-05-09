import {DBusInterfaceOpts} from './DBusInterfaceOpts'

export interface DBusInterfacePropertyOpts extends DBusInterfaceOpts {
    readonly property: string
}