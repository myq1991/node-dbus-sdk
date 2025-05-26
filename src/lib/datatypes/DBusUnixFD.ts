import {DBusSignedValue} from '../DBusSignedValue'

export class DBusUnixFD extends DBusSignedValue {
    constructor(value: number) {
        super('h', value)
    }
}