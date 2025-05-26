import {DBusTypeClass} from '../DBusTypeClass'

export class DBusVariant<T extends DBusTypeClass = DBusTypeClass> extends DBusTypeClass {

    public static type: string = 'v'

    constructor(value: T) {
        super(DBusVariant.type, value)
    }
}