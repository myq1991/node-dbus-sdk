/**
 * An annotation of an interface, method, argument, property or signal in introspection data, such as
 * org.freedesktop.DBus.Deprecated or org.freedesktop.DBus.Property.EmitsChangedSignal.
 */
export interface IntrospectAnnotation {
    /**
     * The annotation's name, e.g. 'org.freedesktop.DBus.Deprecated'.
     */
    name: string

    /**
     * The annotation's value, e.g. 'true'.
     */
    value: string
}
