import {DBusTypeClass} from '../DBusTypeClass'

export class DBusObjectPath extends DBusTypeClass {

    public static type: string = 'o'

    constructor(value: string) {
        super(DBusObjectPath.type, value)
    }
}