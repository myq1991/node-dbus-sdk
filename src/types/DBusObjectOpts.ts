import {DBusServiceOpts} from './DBusServiceOpts'

export interface DBusObjectOpts extends DBusServiceOpts {
    readonly objectPath: string
}