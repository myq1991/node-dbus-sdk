/**
 * Flags for DBus.requestName and LocalService.run({flags}); they combine with |.
 */
export enum RequestNameFlags {
    /**
     * No flag: queue for the name if it is taken, and do not let others take it over.
     */
    DBUS_NAME_FLAG_DEFAULT = 0x00,
    /**
     * Let another connection take the name over with DBUS_NAME_FLAG_REPLACE_EXISTING.
     */
    DBUS_NAME_FLAG_ALLOW_REPLACEMENT = 0x01,
    /**
     * Take the name over if its owner allowed replacement.
     */
    DBUS_NAME_FLAG_REPLACE_EXISTING = 0x02,
    /**
     * Fail (DBUS_REQUEST_NAME_REPLY_EXISTS) instead of queueing when the name is taken.
     */
    DBUS_NAME_FLAG_DO_NOT_QUEUE = 0x04
}