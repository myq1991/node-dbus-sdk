import {IntrospectInterface} from './IntrospectInterface'

/**
 * Interface defining the structure of introspection data for a DBus object node.
 * Used to describe the interfaces available on a specific object node during introspection.
 */
export interface IntrospectNode {
    /**
     * An array of interfaces defined for the DBus object node.
     * Each interface contains metadata about its methods, properties, and signals for introspection purposes.
     */
    interface: IntrospectInterface[]
}
