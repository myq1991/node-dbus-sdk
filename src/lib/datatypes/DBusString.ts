import {DBusSignedValue} from '../DBusSignedValue'

export class DBusString extends DBusSignedValue {
    constructor(value: string) {
        super('s', value)
    }
}