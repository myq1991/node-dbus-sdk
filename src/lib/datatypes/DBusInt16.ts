import {DBusSignedValue} from '../DBusSignedValue'

export class DBusInt16 extends DBusSignedValue {
    constructor(value: number) {
        super('n', value)
    }
}