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
}
