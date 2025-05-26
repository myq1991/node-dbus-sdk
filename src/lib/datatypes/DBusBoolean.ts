import {DBusSignedValue} from '../DBusSignedValue'

export class DBusBoolean extends DBusSignedValue {
    constructor(value: boolean) {
        super('b', value)
    }
}