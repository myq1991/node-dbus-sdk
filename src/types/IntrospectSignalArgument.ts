/**
 * Interface defining the structure of introspection data for a DBus signal argument.
 * Used to describe an argument of a signal on a DBus interface during introspection.
 */
export interface IntrospectSignalArgument {
    /**
     * The name of the argument.
     * This is used for documentation or introspection purposes to identify the argument.
     */
    name: string

    /**
     * The DBus type signature of the argument.
     * This is a string representing the data type of the argument (e.g., 's' for string, 'i' for integer).
     */
    type: string
}
