import {DBusMessage} from '../lib/DBusMessage'

/**
 * A signal as received, with where it came from: what DBusSignalEmitter.onAny listeners get.
 */
export interface ReceivedSignal {
    /**
     * Unique bus name of the sender, e.g. ':1.42'.
     */
    sender: string

    /**
     * Object path the signal was emitted from.
     */
    objectPath: string

    /**
     * Interface of the signal.
     */
    interface: string

    /**
     * Name of the signal, e.g. 'PropertiesChanged'.
     */
    name: string

    /**
     * The signal's arguments, as a listener of the signal's name receives them.
     */
    args: any[]

    /**
     * The signal message itself, for anything else in its header.
     */
    message: DBusMessage
}
