import {DBusServiceOpts} from './DBusServiceOpts'
import {DBusService} from '../DBusService'

export interface DBusObjectOpts extends DBusServiceOpts {
    readonly objectPath: string
    readonly dbusService: DBusService
}