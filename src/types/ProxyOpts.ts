import {DecodeOpts} from './DecodeOpts'

/**
 * Options for proxies: interfaces (DBus.getInterface, DBusObject.getInterface) and object managers
 * (DBus.getObjectManager).
 */
export interface ProxyOpts {
    /**
     * How to give the values the proxy receives (method results, property values, signal arguments), overriding
     * the connection's DecodeOpts.
     *
     * @example
     * const connection = await bus.getInterface('org.freedesktop.NetworkManager', path, 'org.freedesktop.NetworkManager.Settings.Connection', {decode: {types: 'variants'}})
     */
    decode?: DecodeOpts
}
