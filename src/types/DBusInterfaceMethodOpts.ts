import {DBusInterfaceOpts} from './DBusInterfaceOpts'

export interface DBusInterfaceMethodOpts extends DBusInterfaceOpts {
    readonly method: string
}