/**
 * Defines common connection options shared across different DBus connection methods.
 * This interface provides configuration settings that can be applied to various connection types.
 */
export interface CommonConnectOpts {
    /**
     * Optional flag to enable advanced response handling for DBus messages.
     * When set to true, DBus return messages are organized using DBusTypeClass instances for structured data representation.
     * Defaults to false, which returns plain JavaScript values.
     */
    advancedResponse?: boolean
    /**
     * Optional flag to enable auto convert bigint to javascript number for DBus messages.
     */
    convertBigIntToNumber?: boolean
    /**
     * Default number of milliseconds to wait for the reply to a method call before rejecting it with a TimeoutError,
     * for calls that do not set their own timeout. Unset means no timeout.
     */
    callTimeout?: number
}
