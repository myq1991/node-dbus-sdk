import {DBusTypeClass} from '../DBusTypeClass'

/**
 * A DBus UINT64 ('t'): an unsigned 64-bit integer.
 * Use it to give a value this type explicitly, e.g. inside a variant, where a plain bigint would get the inferred type.
 *
 * @example
 * await iface.method.SetValue(new DBusUInt64(2n ** 63n)) // a 'v' argument holding a 't'
 */
export class DBusUInt64 extends DBusTypeClass {

    /**
     * The DBus type code, 't'.
     */
    public static type: string = 't'

    /**
     * @param value - The value, a bigint, checked against the type when it is encoded.
     */
    constructor(value: bigint) {
        super(DBusUInt64.type, value)
    }
}