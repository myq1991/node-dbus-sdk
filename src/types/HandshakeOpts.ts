/**
 * Interface defining options for the DBus handshake process.
 * Used to configure authentication and connection behavior during the initial connection to a DBus server.
 */
export interface HandshakeOpts {
    /**
     * An optional array of authentication methods to use during the handshake.
     * These specify the mechanisms for authenticating with the DBus server (e.g., 'EXTERNAL', 'DBUS_COOKIE_SHA1').
     * If not provided, a default set of methods may be used.
     */
    authMethods?: string[]

    /**
     * An optional user ID (UID) to present during authentication.
     * This may be used with certain authentication mechanisms to identify the connecting user.
     * If not provided, the system may use the effective UID of the process.
     */
    uid?: number

    /**
     * An optional flag to control the verbosity of objects during the handshake.
     * If set to false, more detailed or verbose object information may be included.
     * Defaults to true (simplified output) if not specified.
     */
    simple?: boolean

    /**
     * An optional flag to indicate whether to attempt a direct connection.
     * If set to true, the client may try to bypass certain intermediaries or proxies for a direct connection to the server.
     * Defaults to false if not specified.
     */
    direct?: boolean
}
