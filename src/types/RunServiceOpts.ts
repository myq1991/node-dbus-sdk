import {ConnectOpts} from './ConnectOpts'
import {RequestNameFlags} from '../lib/enums/RequestNameFlags'

/**
 * A type representing options for running a DBus service.
 * Combines connection options for establishing a connection to a DBus bus with optional flags
 * to control the behavior of requesting the service name on the bus.
 */
export type RunServiceOpts = ConnectOpts & {
    /**
     * Optional flags to customize the behavior of requesting the service name on the DBus bus.
     * These flags can control aspects such as whether to replace an existing service or queue
     * if the name is already in use. Defaults to a standard behavior if not specified.
     * See RequestNameFlags for possible values.
     */
    flags?: RequestNameFlags
}
