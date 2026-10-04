import {DBusTypeClass} from '../DBusTypeClass'

/**
 * A DBus BYTE ('y'): an unsigned 8-bit integer, 0 to 255.
 * Use it to give a value this type explicitly, e.g. inside a variant, where a plain number would get the inferred type.
 *
 * @example
 * await iface.method.SetValue(new DBusByte(255)) // a 'v' argument holding a 'y'
 */
export class DBusByte extends DBusTypeClass {

    /**
     * The DBus type code, 'y'.
     */
    public static type: string = 'y'

    /**
     * @param value - The value, a number, checked against the type when it is encoded.
     */
    constructor(value: number) {
        super(DBusByte.type, value)
    }
}