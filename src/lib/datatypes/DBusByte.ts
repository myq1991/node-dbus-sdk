import {DBusSignedValue} from '../DBusSignedValue'

export class DBusByte extends DBusSignedValue {
    constructor(value: number) {
        super('y', value)
    }
}