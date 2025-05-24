/**
 * Interface defining options for retrieving a property value from a DBus object.
 * Used to specify the target service, object, interface, and property to query.
 */
export interface GetPropertyValueOpts {
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
     * The name of the property to retrieve.
     * This is the specific property identifier (e.g., 'Names').
     */
    property: string
}
