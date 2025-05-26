import {DBusSignedValue} from '../DBusSignedValue'

export class DBusSignature extends DBusSignedValue {
    constructor(value: string) {
        super('g', value)
    }
}