import {DBusInterfaceOpts} from './DBusInterfaceOpts'

export interface DBusInterfaceSignalOpts extends DBusInterfaceOpts {
    readonly signal: string
}