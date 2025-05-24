import {IntrospectMethod} from './IntrospectMethod'
import {IntrospectProperty} from './IntrospectProperty'
import {IntrospectSignal} from './IntrospectSignal'

/**
 * Interface defining the structure of introspection data for a DBus interface.
 * Used to describe the methods, properties, and signals available on a specific interface during introspection.
 */
export interface IntrospectInterface {
    /**
     * The name of the DBus interface.
     * This is a string identifier for the interface (e.g., 'org.freedesktop.DBus.Properties').
     */
    name: string

    /**
     * An array of methods defined in the interface.
     * Each method contains metadata such as its name, arguments, and return types for introspection purposes.
     */
    method: IntrospectMethod[]

    /**
     * An array of properties defined in the interface.
     * Each property contains metadata such as its name, type, and access permissions (read/write) for introspection purposes.
     */
    property: IntrospectProperty[]

    /**
     * An array of signals defined in the interface.
     * Each signal contains metadata such as its name and arguments for introspection purposes.
     */
    signal: IntrospectSignal[]
}
