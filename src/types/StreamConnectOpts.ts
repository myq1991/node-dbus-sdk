import {Duplex} from 'node:stream'
import {CommonConnectOpts} from './CommonConnectOpts'

/**
 * Interface defining options for connecting to a DBus service using a stream.
 * Used to specify a duplex stream for communication with the DBus.
 */
export interface StreamConnectOpts extends CommonConnectOpts {
    /**
     * The duplex stream to use for communication.
     * This stream handles both reading from and writing to the DBus connection.
     */
    stream: Duplex
}
