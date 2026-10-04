import EventEmitter from 'node:events'

/**
 * Interface defining options for an argument of a DBus signal.
 */
export interface DefineSignalArgumentOpts {
    /**
     * The optional name of the argument, for introspection.
     */
    name?: string

    /**
     * The DBus type signature of the argument (e.g., 's' for string, 'u' for unsigned integer).
     */
    type: string

    /**
     * Annotations to publish in the introspection data, as name → value.
     */
    annotations?: Record<string, string>
}

/**
 * Interface defining options for a DBus signal.
 * Used to specify the metadata and behavior of a signal exposed on a DBus interface.
 */
export interface DefineSignalOpts {
    /**
     * The name of the signal.
     * This is the identifier used to emit or listen for the signal via DBus (e.g., 'NameOwnerChanged').
     */
    name: string

    /**
     * An optional array of arguments for the signal.
     * Each argument is defined with metadata (e.g., name and type) for introspection purposes.
     */
    args?: DefineSignalArgumentOpts[]

    /**
     * The EventEmitter instance associated with the signal.
     * This is used to handle the emission and subscription of events for the signal in the application.
     */
    eventEmitter: EventEmitter

    /**
     * Annotations to publish in the introspection data, as name → value,
     * e.g. {'org.freedesktop.DBus.Deprecated': 'true'}.
     */
    annotations?: Record<string, string>
}
