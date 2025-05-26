import {DBusSignedValue} from '../DBusSignedValue'

export class DBusUint64 extends DBusSignedValue {
    constructor(value: bigint) {
        super('t', value)
    }
}