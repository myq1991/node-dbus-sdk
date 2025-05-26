import {CommonConnectOpts} from './CommonConnectOpts'

/**
 * Interface defining options for connecting to a DBus service over TCP.
 * Used to specify the host, port, and timeout settings for a TCP connection.
 */
export interface TCPConnectOpts extends CommonConnectOpts {
    /**
     * The hostname or IP address of the DBus server to connect to.
     * This specifies the target server for the TCP connection (e.g., 'localhost' or '192.168.1.100').
     */
    host: string

    /**
     * The port number on which the DBus server is listening.
     * This specifies the target port for the TCP connection (e.g.,  dbus default port).
     */
    port: number

    /**
     * The optional timeout for the connection attempt, in milliseconds.
     * If not specified, a default timeout may be used or the connection may block indefinitely.
     */
    timeout?: number
}
