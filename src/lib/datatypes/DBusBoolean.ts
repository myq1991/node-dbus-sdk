import {DBusTypeClass} from '../DBusTypeClass'

export class DBusBoolean extends DBusTypeClass {

    public static type: string = 'b'

    constructor(value: boolean) {
        super(DBusBoolean.type, value)
    }
}