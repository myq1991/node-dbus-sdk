import {DBusPropertyAccess} from '../lib/DBusPropertyAccess'

/**
 * Interface defining the structure of introspection data for a DBus property.
 * Used to describe a property available on a DBus interface during introspection.
 */
export interface IntrospectProperty {
    /**
     * The name of the property.
     * This is a string identifier for the property (e.g., 'Volume').
     */
    name: string

    /**
     * The DBus type signature of the property.
     * This is a string representing the data type of the property (e.g., 's' for string, 'i' for integer).
     */
    type: string

    /**
     * The access permissions for the property.
     * This specifies whether the property is read-only, write-only, or read-write.
     * It uses the DBusPropertyAccess enum or type to define the access level.
     */
    access: DBusPropertyAccess
}
