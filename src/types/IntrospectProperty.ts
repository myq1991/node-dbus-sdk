import {DBusPropertyAccess} from '../lib/DBusPropertyAccess'

export interface IntrospectProperty {
    name: string
    type: string
    access: DBusPropertyAccess
}