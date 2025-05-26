import {DBusSignedValue} from '../DBusSignedValue'

export class DBusInt64 extends DBusSignedValue {
    constructor(value: bigint) {
        super('x', value)
    }
}