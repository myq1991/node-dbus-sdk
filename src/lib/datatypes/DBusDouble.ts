import {DBusSignedValue} from '../DBusSignedValue'

export class DBusDouble extends DBusSignedValue {
    constructor(value: number) {
        super('d', value)
    }
}