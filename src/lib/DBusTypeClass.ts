import {DBusSignedValue} from './DBusSignedValue'

/**
 * Base of the type classes (DBusUInt32, DBusString, DBusArray, …): a DBusSignedValue whose type is given by its class.
 */
export class DBusTypeClass extends DBusSignedValue {
    /**
     * The DBus type code of the class, e.g. 'u'.
     */
    public static type: string
}
