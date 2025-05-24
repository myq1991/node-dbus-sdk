import {IntrospectSignalArgument} from './IntrospectSignalArgument'
import EventEmitter from 'node:events'

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
    args?: IntrospectSignalArgument[]

    /**
     * The EventEmitter instance associated with the signal.
     * This is used to handle the emission and subscription of events for the signal in the application.
     */
    eventEmitter: EventEmitter
}
