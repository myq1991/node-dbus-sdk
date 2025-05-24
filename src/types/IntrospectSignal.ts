import {IntrospectSignalArgument} from './IntrospectSignalArgument'

/**
 * Interface defining the structure of introspection data for a DBus signal.
 * Used to describe a signal available on a DBus interface during introspection.
 */
export interface IntrospectSignal {
    /**
     * The name of the signal.
     * This is a string identifier for the signal (e.g., 'PropertiesChanged').
     */
    name: string

    /**
     * An array of arguments for the signal.
     * Each argument contains metadata such as its name and type for introspection purposes.
     */
    arg: IntrospectSignalArgument[]
}
