import {DBusMessage} from '../../lib/DBusMessage'
import {DBusMessageHeader} from '../../types/DBusMessageHeader'

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

/**
 * Encodes a well-framed message whose body no decoder may accept: a BOOLEAN with the value 2.
 * It is encoded as UINT32 2 and the SIGNATURE header field is then changed from 'u' to 'b'.
 *
 * @param header - Header fields of the message; its signature is replaced.
 * @returns The raw message.
 */
export function undecodableMessage(header: Partial<DBusMessageHeader>): Buffer {
    const raw: Buffer = DBusMessage.encode({...header, signature: 'u'}, 2)
    const signatureField: number = raw.indexOf(Buffer.from([0x08, 0x01, 0x67, 0x00, 0x01, 0x75, 0x00]))
    raw[signatureField + 5] = 0x62
    return raw
}
