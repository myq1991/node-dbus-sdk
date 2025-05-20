import {DBusPropertyAccess} from '../lib/DBusPropertyAccess'

export interface DefinePropertyOpts {
    name: string
    type: string
    getter?: () => Promise<any> | any
    setter?: (value: any) => Promise<void> | void
}