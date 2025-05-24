import {Duplex} from 'node:stream'

/**
 * Interface defining options for connecting to a DBus service using a stream.
 * Used to specify a duplex stream for communication with the DBus.
 */
export interface StreamConnectOpts {
    /**
     * The duplex stream to use for communication.
     * This stream handles both reading from and writing to the DBus connection.
     */
    stream: Duplex
}
