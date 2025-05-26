import {DBusSignedValue} from '../DBusSignedValue'

export class DBusUint32 extends DBusSignedValue {
    constructor(value: number) {
        super('u', value)
    }
}