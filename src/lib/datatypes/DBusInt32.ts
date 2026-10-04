import {DBusTypeClass} from '../DBusTypeClass'

/**
 * A DBus INT32 ('i'): a signed 32-bit integer.
 * Use it to give a value this type explicitly, e.g. inside a variant, where a plain number would get the inferred type.
 *
 * @example
 * await iface.method.SetValue(new DBusInt32(-1)) // a 'v' argument holding a 'i'
 */
export class DBusInt32 extends DBusTypeClass {

    /**
     * The DBus type code, 'i'.
     */
    public static type: string = 'i'

    /**
     * @param value - The value, a number, checked against the type when it is encoded.
     */
    constructor(value: number) {
        super(DBusInt32.type, value)
    }
}