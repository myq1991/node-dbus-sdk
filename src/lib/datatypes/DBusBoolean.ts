import {DBusTypeClass} from '../DBusTypeClass'

/**
 * A DBus BOOLEAN ('b'): a boolean.
 * Use it to give a value this type explicitly; a plain boolean is inferred as 'b' anyway.
 *
 * @example
 * await iface.method.SetValue(new DBusBoolean(true)) // a 'v' argument holding a 'b'
 */
export class DBusBoolean extends DBusTypeClass {

    /**
     * The DBus type code, 'b'.
     */
    public static type: string = 'b'

    /**
     * @param value - The value, a boolean, checked against the type when it is encoded.
     */
    constructor(value: boolean) {
        super(DBusBoolean.type, value)
    }
}