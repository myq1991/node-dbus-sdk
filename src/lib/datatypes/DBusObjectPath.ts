import {DBusSignedValue} from '../DBusSignedValue'

export class DBusObjectPath extends DBusSignedValue {
    constructor(value: string) {
        super('o', value)
    }
}