import {DBusTypeClass} from '../DBusTypeClass'

/**
 * A DBus UINT16 ('q'): an unsigned 16-bit integer.
 * Use it to give a value this type explicitly, e.g. inside a variant, where a plain number would get the inferred type.
 *
 * @example
 * await iface.method.SetValue(new DBusUInt16(1)) // a 'v' argument holding a 'q'
 */
export class DBusUInt16 extends DBusTypeClass {

    /**
     * The DBus type code, 'q'.
     */
    public static type: string = 'q'

    /**
     * @param value - The value, a number, checked against the type when it is encoded.
     */
    constructor(value: number) {
        super(DBusUInt16.type, value)
    }
}