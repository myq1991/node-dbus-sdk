import {DBusTypeClass} from '../DBusTypeClass'

/**
 * A DBus INT16 ('n'): a signed 16-bit integer.
 * Use it to give a value this type explicitly, e.g. inside a variant, where a plain number would get the inferred type.
 *
 * @example
 * await iface.method.SetValue(new DBusInt16(-1)) // a 'v' argument holding a 'n'
 */
export class DBusInt16 extends DBusTypeClass {

    /**
     * The DBus type code, 'n'.
     */
    public static type: string = 'n'

    /**
     * @param value - The value, a number, checked against the type when it is encoded.
     */
    constructor(value: number) {
        super(DBusInt16.type, value)
    }
}