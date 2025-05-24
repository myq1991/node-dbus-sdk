/**
 * Interface defining options for setting the value of a DBus property.
 * Used to specify the target service, object, interface, property, and value for updating a property on a DBus object.
 */
export interface SetPropertyValueOpts {
    /**
     * The name of the service hosting the property.
     * This is typically a well-known service name (e.g., 'org.freedesktop.DBus').
     */
    service: string

    /**
     * The object path of the DBus object containing the property.
     * This specifies the path of the target object (e.g., '/org/freedesktop/DBus').
     */
    objectPath: string

    /**
     * The interface name that defines the property.
     * This identifies the interface containing the property (e.g., 'org.freedesktop.DBus.Properties').
     */
    interface: string

    /**
     * The name of the property to set.
     * This is the specific property identifier (e.g., 'Volume').
     */
    property: string

    /**
     * The value to set for the property.
     * This can be of any type, depending on the property's expected type.
     */
    value: any

    /**
     * The optional type signature of the property's value.
     * This is a string describing the type of the value (e.g., 's' for string, 'i' for integer).
     * If not provided, it may be inferred or default to an empty signature.
     */
    signature?: string
}
