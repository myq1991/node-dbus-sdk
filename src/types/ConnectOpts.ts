import {BusAddressConnectOpts} from './BusAddressConnectOpts'
import {SocketConnectOpts} from './SocketConnectOpts'
import {TCPConnectOpts} from './TCPConnectOpts'
import {StreamConnectOpts} from './StreamConnectOpts'

/**
 * Type representing different connection options for connecting to a DBus bus.
 * This is a union type that allows for various connection configurations depending on the transport method.
 * It can be one of the following:
 * - BusAddressConnectOpts: For connecting using a bus address string (e.g., UNIX socket path).
 * - SocketConnectOpts: For connecting using a socket configuration.
 * - TCPConnectOpts: For connecting using TCP/IP settings.
 * - StreamConnectOpts: For connecting using a custom stream implementation.
 */
export type ConnectOpts =
    BusAddressConnectOpts |
    SocketConnectOpts |
    TCPConnectOpts |
    StreamConnectOpts
