import {DecodeOpts} from './DecodeOpts'

/**
 * Defines common connection options shared across different DBus connection methods.
 * This interface provides configuration settings that can be applied to various connection types.
 */
export interface CommonConnectOpts {
    /**
     * How received values are given by default: replies, signals, and the arguments of calls a LocalService
     * answers. Calls, proxies and signal emitters can override it. See DecodeOpts.
     */
    decode?: DecodeOpts

    /**
     * Default number of milliseconds to wait for the reply to a method call before rejecting it with a TimeoutError,
     * for calls that do not set their own timeout. Unset means no timeout.
     */
    callTimeout?: number
}
