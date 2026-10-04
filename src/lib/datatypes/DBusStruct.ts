import {DBusTypeClass} from '../DBusTypeClass'

/**
 * A DBus STRUCT ('(...)'): a fixed sequence of fields of any types.
 *
 * @example
 * new DBusStruct([new DBusString('answer'), new DBusInt32(42)])   // '(si)'
 */
export class DBusStruct<T extends DBusTypeClass = DBusTypeClass> extends DBusTypeClass {

    /**
     * The DBus type code, '('.
     */
    public static type: string = '('

    /**
     * @param value - The fields, in order.
     */
    constructor(value: T[]) {
        super(DBusStruct.type, value)
    }
}