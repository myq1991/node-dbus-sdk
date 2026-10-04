import {DBusTypeClass} from '../DBusTypeClass'

/**
 * A DBus STRING ('s'): a UTF-8 string without NUL characters.
 * Use it to give a value this type explicitly, e.g. inside a variant, where a plain string would get the inferred type.
 *
 * @example
 * await iface.method.SetValue(new DBusString('text')) // a 'v' argument holding a 's'
 */
export class DBusString extends DBusTypeClass {

    /**
     * The DBus type code, 's'.
     */
    public static type: string = 's'

    /**
     * @param value - The value, a string, checked against the type when it is encoded.
     */
    constructor(value: string) {
        super(DBusString.type, value)
    }
}