import {CommonConnectOpts} from './CommonConnectOpts'

/**
 * Interface defining connection options for connecting to a DBus bus using a bus address.
 */
export interface BusAddressConnectOpts extends CommonConnectOpts {
    /**
     * The DBus bus address to connect to.
     * This can be a string representing the address of the bus (e.g., 'unix:path=/var/run/dbus/system_bus_socket').
     * If not provided, a default or environment-based address may be used.
     */
    busAddress?: string

    /**
     * The timeout value in milliseconds for the connection attempt.
     * If not specified, a default timeout may be applied by the underlying implementation.
     */
    timeout?: number
}
