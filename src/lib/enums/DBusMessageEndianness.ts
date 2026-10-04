/**
 * Byte order of a message, the first byte of its header: 'l' (108) for little-endian, 'B' (66) for big-endian.
 * The library writes little-endian and reads both.
 */
export enum DBusMessageEndianness {
    /**
     * Little-endian ('l').
     */
    LE = 108,
    /**
     * Big-endian ('B').
     */
    BE = 66
}