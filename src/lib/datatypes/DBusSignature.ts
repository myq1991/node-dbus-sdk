import {DBusTypeClass} from '../DBusTypeClass'

export class DBusSignature extends DBusTypeClass {

    public static type: string = 'g'

    constructor(value: string) {
        super(DBusSignature.type, value)
    }
}