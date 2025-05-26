import {CommonConnectOpts} from './CommonConnectOpts'

/**
 * Interface defining options for connecting to a DBus socket.
 * Used to specify the socket path and connection timeout settings.
 */
export interface SocketConnectOpts extends CommonConnectOpts {
    /**
     * The path or address of the socket to connect to.
     * This could be a file path for a Unix socket (e.g., '/var/run/dbus/system_bus_socket')
     * or another type of socket identifier depending on the transport.
     */
    socket: string

    /**
     * The optional timeout for the connection attempt, in milliseconds.
     * If not specified, a default timeout may be used or the connection may block indefinitely.
     */
    timeout?: number
}
