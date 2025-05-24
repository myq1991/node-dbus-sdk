/**
 * Interface defining the structure of introspection data for a DBus method argument.
 * Used to describe an argument of a method on a DBus interface during introspection.
 */
export interface IntrospectMethodArgument {
    /**
     * The optional name of the argument.
     * This can be used for documentation or introspection purposes. If not provided, the argument may be unnamed.
     */
    name?: string

    /**
     * The DBus type signature of the argument.
     * This is a string representing the data type of the argument (e.g., 's' for string, 'i' for integer).
     */
    type: string

    /**
     * The direction of the argument.
     * Indicates whether the argument is an input ('in') or output ('out') parameter for the method.
     */
    direction: string
}
