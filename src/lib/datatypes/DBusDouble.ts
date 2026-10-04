import {DBusTypeClass} from '../DBusTypeClass'

/**
 * A DBus DOUBLE ('d'): an IEEE 754 double.
 * Use it to give a value this type explicitly, e.g. inside a variant, where a plain number would get the inferred type.
 *
 * @example
 * await iface.method.SetValue(new DBusDouble(0.5)) // a 'v' argument holding a 'd'
 */
export class DBusDouble extends DBusTypeClass {

    /**
     * The DBus type code, 'd'.
     */
    public static type: string = 'd'

    /**
     * @param value - The value, a number, checked against the type when it is encoded.
     */
    constructor(value: number) {
        super(DBusDouble.type, value)
    }
}