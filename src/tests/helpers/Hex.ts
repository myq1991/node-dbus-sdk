/**
 * Converts a hex string into a Buffer, ignoring any whitespace.
 * Allows test vectors to be grouped visually, e.g. `hex('08000000 00000000')`.
 *
 * @param bytes - Hex string, optionally containing whitespace between byte groups.
 * @returns The decoded Buffer.
 */
export function hex(bytes: string): Buffer {
    return Buffer.from(bytes.replace(/\s+/g, ''), 'hex')
}
