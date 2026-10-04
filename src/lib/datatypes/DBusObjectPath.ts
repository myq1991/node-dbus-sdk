import {DBusTypeClass} from '../DBusTypeClass'

/**
 * A DBus OBJECT_PATH ('o'): an object path.
 * Use it to give a value this type explicitly, e.g. inside a variant, where a plain string would get the inferred type.
 *
 * @example
 * await iface.method.SetValue(new DBusObjectPath('/org/example/Object')) // a 'v' argument holding a 'o'
 */
export class DBusObjectPath extends DBusTypeClass {

    /**
     * The DBus type code, 'o'.
     */
    public static type: string = 'o'

    /**
     * @param value - The value, a string, checked against the type when it is encoded.
     */
    constructor(value: string) {
        super(DBusObjectPath.type, value)
    }
}