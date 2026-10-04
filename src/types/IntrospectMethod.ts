import {IntrospectAnnotation} from './IntrospectAnnotation'
import {IntrospectMethodArgument} from './IntrospectMethodArgument'

/**
 * Interface defining the structure of introspection data for a DBus method.
 * Used to describe a method available on a DBus interface during introspection.
 */
export interface IntrospectMethod {
    /**
     * The name of the method.
     * This is a string identifier for the method (e.g., 'GetProperty').
     */
    name: string

    /**
     * An array of arguments for the method.
     * Each argument contains metadata such as its name, type, and direction (input or output) for introspection purposes.
     */
    arg: IntrospectMethodArgument[]

    /**
     * The method's annotations from the introspection data, e.g. [{name: 'org.freedesktop.DBus.Deprecated', value: 'true'}];
     * absent when it has none.
     */
    annotation?: IntrospectAnnotation[]
}
