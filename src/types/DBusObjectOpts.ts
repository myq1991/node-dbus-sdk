import {DBusService} from '../DBusService'

export interface DBusObjectOpts extends DBusService {
    readonly objectPath: string
}