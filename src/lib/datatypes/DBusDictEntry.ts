import {DBusTypeClass} from '../DBusTypeClass'

/**
 * A DBus DICT_ENTRY ('{..}'): one key/value pair of a dictionary; dictionaries are arrays of them.
 *
 * @example
 * new DBusArray([new DBusDictEntry([new DBusString('count'), new DBusVariant(new DBusUInt32(7))])])   // 'a{sv}'
 */
export class DBusDictEntry<T extends DBusTypeClass = DBusTypeClass> extends DBusTypeClass {

    /**
     * The DBus type code, '{'.
     */
    public static type: string = '{'

    /**
     * @param value - The key, which must be of a basic type, and the value.
     */
    constructor(value: [T, T]) {
        super(DBusDictEntry.type, value)
    }
}