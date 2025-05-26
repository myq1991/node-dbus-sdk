import {DBusTypeClass} from '../DBusTypeClass'

export class DBusDictEntry<T extends DBusTypeClass = DBusTypeClass> extends DBusTypeClass {

    public static type: string = '{'

    constructor(value: [T, T]) {
        super(DBusDictEntry.type, value)
    }
}