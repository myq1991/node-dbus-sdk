import {DBusMessage} from '../../lib/DBusMessage'

/**
 * Splits a raw DBus message buffer into the parts expected by DBusMessage.decode and decodes it.
 * Only little-endian framing is supported, which is what this library and libdbus emit by default.
 *
 * @param raw - A complete wire-format DBus message.
 * @returns The decoded DBusMessage.
 */
export function decodeWireMessage(raw: Buffer): DBusMessage {
    const fieldsLength: number = raw.readUInt32LE(12)
    const bodyLength: number = raw.readUInt32LE(4)
    return DBusMessage.decode(raw.subarray(0, 16), raw.subarray(16), fieldsLength, bodyLength)
}

/**
 * Extracts the body bytes of a raw DBus message.
 * The body always starts on an 8-byte boundary after the header fields, so it can be compared
 * byte-for-byte with a body encoded independently at offset 0.
 *
 * @param raw - A complete wire-format DBus message.
 * @returns The body bytes.
 */
export function wireMessageBody(raw: Buffer): Buffer {
    const bodyLength: number = raw.readUInt32LE(4)
    return raw.subarray(raw.length - bodyLength)
}

/**
 * Splits a buffer containing several concatenated DBus messages into individual messages.
 *
 * @param data - Concatenated little-endian DBus messages.
 * @returns The individual raw messages.
 */
export function splitWireMessages(data: Buffer): Buffer[] {
    const messages: Buffer[] = []
    let offset: number = 0
    while (offset < data.length) {
        const fieldsLength: number = data.readUInt32LE(offset + 12)
        const bodyLength: number = data.readUInt32LE(offset + 4)
        const length: number = 16 + (((fieldsLength + 7) >> 3) << 3) + bodyLength
        messages.push(data.subarray(offset, offset + length))
        offset += length
    }
    return messages
}
