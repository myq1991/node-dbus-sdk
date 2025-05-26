import {DBusSignedValue} from '../DBusSignedValue'

export class DBusInt32 extends DBusSignedValue {
    constructor(value: number) {
        super('i', value)
    }
}