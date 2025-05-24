import {ConnectOpts} from './ConnectOpts'
import {HandshakeOpts} from './HandshakeOpts'

/**
 * Type representing the combined options for creating a DBus connection.
 * This type extends both ConnectOpts (for specifying the transport and connection details)
 * and HandshakeOpts (for specifying authentication and handshake behavior during connection setup).
 * It allows for a comprehensive configuration of the DBus connection process.
 */
export type CreateConnectOpts = ConnectOpts & HandshakeOpts
