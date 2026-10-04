import {DBusTypeClass} from '../DBusTypeClass'

/**
 * A DBus UINT32 ('u'): an unsigned 32-bit integer.
 * Use it to give a value this type explicitly, e.g. inside a variant, where a plain number would get the inferred type.
 *
 * @example
 * await iface.method.SetValue(new DBusUInt32(7)) // a 'v' argument holding a 'u'
 */
export class DBusUInt32 extends DBusTypeClass {

    /**
     * The DBus type code, 'u'.
     */
    public static type: string = 'u'

    /**
     * @param value - The value, a number, checked against the type when it is encoded.
     */
    constructor(value: number) {
        super(DBusUInt32.type, value)
    }
}