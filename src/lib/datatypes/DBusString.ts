import {DBusTypeClass} from '../DBusTypeClass'

export class DBusString extends DBusTypeClass {

    public static type: string = 's'

    constructor(value: string) {
        super(DBusString.type, value)
    }
}