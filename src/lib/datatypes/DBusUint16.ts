import {DBusSignedValue} from '../DBusSignedValue'

export class DBusUint16 extends DBusSignedValue {
    constructor(value: number) {
        super('q', value)
    }
}