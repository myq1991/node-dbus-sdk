/**
 * Options for stopping a LocalService.
 */
export interface StopServiceOpts {
    /**
     * Stop in two phases: first answer new method calls with org.freedesktop.DBus.Error.ServiceUnknown and wait for
     * the calls being handled to finish, then release the name and disconnect. Without it (the default), the name is
     * released and the connection closed immediately, and replies of calls still being handled are lost.
     */
    graceful?: boolean

    /**
     * With graceful, the longest time in milliseconds to wait for calls being handled before stopping anyway.
     * Without it, stop waits until every call has finished.
     */
    timeout?: number
}
