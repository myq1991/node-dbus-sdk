import {DBusTypeClass} from '../DBusTypeClass'

/**
 * A DBus VARIANT ('v'): a value that carries its own type.
 *
 * @example
 * new DBusVariant(new DBusUInt32(7))   // a variant holding a 'u'
 */
export class DBusVariant<T extends DBusTypeClass = DBusTypeClass> extends DBusTypeClass {

    /**
     * The DBus type code, 'v'.
     */
    public static type: string = 'v'

    /**
     * @param value - The content, whose type class is the variant's inner type.
     */
    constructor(value: T) {
        super(DBusVariant.type, value)
    }
}