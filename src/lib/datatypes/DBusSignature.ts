import {DBusTypeClass} from '../DBusTypeClass'

/**
 * A DBus SIGNATURE ('g'): a type signature.
 * Use it to give a value this type explicitly, e.g. inside a variant, where a plain string would get the inferred type.
 *
 * @example
 * await iface.method.SetValue(new DBusSignature('a{sv}')) // a 'v' argument holding a 'g'
 */
export class DBusSignature extends DBusTypeClass {

    /**
     * The DBus type code, 'g'.
     */
    public static type: string = 'g'

    /**
     * @param value - The value, a string, checked against the type when it is encoded.
     */
    constructor(value: string) {
        super(DBusSignature.type, value)
    }
}