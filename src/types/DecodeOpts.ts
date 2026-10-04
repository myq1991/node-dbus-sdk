/**
 * How received values are given to you. Set defaults for a connection with DBus.connect({decode}) (or
 * LocalService.run({decode}) for the arguments a service's methods receive), and override them per call, proxy or
 * signal emitter.
 *
 * @example
 * // Read a{sv} settings with the type of every variant kept, to change and send them back unchanged
 * const [settings] = await bus.invoke({..., method: 'GetSettings', decode: {types: 'variants'}})
 */
export interface DecodeOpts {
    /**
     * Where values keep their DBus type, as type class instances (DBusUInt32, DBusArray, …) whose `signature` and
     * `value` tell the type and the plain value:
     * - 'none' (default): nowhere; everything is a plain value. Variants give their content. Values that came in
     *   variants are still sent back with their original type when the object holding them is sent again.
     * - 'variants': the content of each variant is a type class instance; everything else is plain.
     * - 'all': every value is a type class instance.
     */
    types?: 'none' | 'variants' | 'all'

    /**
     * What dictionaries (a{…}) become: 'object' (default), whose keys are strings, or 'map', a Map whose keys keep
     * their type (numbers, booleans, bigints).
     */
    dictionaries?: 'object' | 'map'

    /**
     * What 64-bit integers (x, t) become: 'bigint' (default), or 'number' when the value is a safe integer
     * (within ±2^53 - 1); larger values stay bigint rather than losing precision.
     */
    int64?: 'bigint' | 'number'
}
