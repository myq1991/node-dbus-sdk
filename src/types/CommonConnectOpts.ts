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
}
