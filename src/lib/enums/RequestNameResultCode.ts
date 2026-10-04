/**
 * Result of requesting a name (DBus.requestName, LocalService.run).
 */
export enum RequestNameResultCode {
    /**
     * This connection now owns the name; method calls to it arrive here.
     */
    DBUS_REQUEST_NAME_REPLY_PRIMARY_OWNER = 1,
    /**
     * The name is taken; this connection is queued and gets it when the owner releases it.
     */
    DBUS_REQUEST_NAME_REPLY_IN_QUEUE = 2,
    /**
     * The name is taken and this connection was not queued (DBUS_NAME_FLAG_DO_NOT_QUEUE).
     */
    DBUS_REQUEST_NAME_REPLY_EXISTS = 3,
    /**
     * This connection already owned the name.
     */
    DBUS_REQUEST_NAME_REPLY_ALREADY_OWNER = 4
}