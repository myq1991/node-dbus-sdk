import {DBusTypeClass} from '../DBusTypeClass'

export class DBusStruct<T extends DBusTypeClass = DBusTypeClass> extends DBusTypeClass {

    public static type: string = '('

    constructor(value: T[]) {
        super(DBusStruct.type, value)
    }
}