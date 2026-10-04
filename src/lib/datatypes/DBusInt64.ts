import {DBusTypeClass} from '../DBusTypeClass'

/**
 * A DBus INT64 ('x'): a signed 64-bit integer.
 * Use it to give a value this type explicitly, e.g. inside a variant, where a plain bigint would get the inferred type.
 *
 * @example
 * await iface.method.SetValue(new DBusInt64(-1n)) // a 'v' argument holding a 'x'
 */
export class DBusInt64 extends DBusTypeClass {

    /**
     * The DBus type code, 'x'.
     */
    public static type: string = 'x'

    /**
     * @param value - The value, a bigint, checked against the type when it is encoded.
     */
    constructor(value: bigint) {
        super(DBusInt64.type, value)
    }
}