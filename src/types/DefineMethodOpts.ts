/**
 * Interface defining options for a method argument in a DBus method definition.
 * Used to specify the metadata for input or output arguments of a DBus method.
 */
export interface DefineMethodArgumentOpts {
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
     * Annotations to publish in the introspection data, as name → value,
     * e.g. {'org.freedesktop.DBus.Deprecated': 'true'}.
     */
    annotations?: Record<string, string>
}

/**
 * Interface defining options for a DBus method.
 * Used to specify the metadata and implementation of a method exposed on a DBus interface.
 */
export interface DefineMethodOpts {
    /**
     * The name of the method.
     * This is the identifier used to call the method via DBus (e.g., 'GetProperty').
     */
    name: string

    /**
     * An optional array of input arguments for the method.
     * Each argument is defined with its type and optional name for introspection purposes.
     */
    inputArgs?: DefineMethodArgumentOpts[]

    /**
     * An optional array of output arguments for the method.
     * Each argument is defined with its type and optional name for introspection purposes.
     */
    outputArgs?: DefineMethodArgumentOpts[]

    /**
     * The implementation of the method.
     * This is a function that takes the input arguments and returns a result (or a Promise of a result).
     * The return value can be a single value, an array of values, or a Promise resolving to either.
     */
    method: (...args: any[]) => Promise<any | any[]> | any | any[]

    /**
     * Whether the method also receives the call's context (the caller's bus name and more, see MethodCallContext)
     * as an extra last argument, after the input arguments. Defaults to false.
     * When the method is called directly through LocalInterface.callMethod, there is no call and the context is undefined.
     */
    withContext?: boolean

    /**
     * Annotations to publish in the introspection data, as name → value,
     * e.g. {'org.freedesktop.DBus.Deprecated': 'true'}.
     */
    annotations?: Record<string, string>
}
