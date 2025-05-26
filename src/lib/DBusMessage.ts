import {DBusMessageHeader} from '../types/DBusMessageHeader'
import {DBusMessageType} from './enums/DBusMessageType'
import {DBusMessageFlags} from './enums/DBusMessageFlags'
import {SerialError} from './Errors'
import {DBusMessageEndianness} from './enums/DBusMessageEndianness'
import {DBusBufferEncoder} from './DBusBufferEncoder'
import {DBusSignedValue} from './DBusSignedValue'
import {DBusBufferDecoder} from './DBusBufferDecoder'

/**
 * A class representing a DBus message.
 * Handles the creation, encoding, and decoding of DBus messages, including headers and bodies.
 * Supports various message types such as method calls, replies, signals, and errors.
 * This class is central to DBus communication, providing the means to construct and parse messages
 * according to the DBus wire protocol.
 */
export class DBusMessage {

    /**
     * The endianness used for encoding and decoding DBus messages.
     * Defaults to little-endian (LE) as it is the most common in DBus implementations.
     * Determines the byte order for multi-byte values in the message.
     */
    public readonly endianness: DBusMessageEndianness = DBusMessageEndianness.LE

    /**
     * The header of the DBus message.
     * Contains metadata such as message type, flags, serial number, and other fields like path and interface.
     * This is essential for routing and processing the message on the DBus.
     */
    public readonly header: DBusMessageHeader

    /**
     * The body of the DBus message.
     * Contains the payload or arguments of the message, such as method parameters or signal data.
     * This is an array that can hold various data types as per the DBus specification.
     */
    public readonly body: any[] = []

    /**
     * Constructor for creating a DBusMessage instance.
     * Initializes the message with a header and optional body content, applying default values for required fields.
     * Defaults ensure that a message is always in a valid initial state for encoding or transmission.
     *
     * @param header - The message header or partial header object, with fields like type, flags, and serial.
     * @param body - Variable number of arguments representing the message body (payload data).
     */
    constructor(header: DBusMessageHeader | Partial<DBusMessageHeader>, ...body: any[]) {
        this.header = {
            type: DBusMessageType.METHOD_CALL, // Default to METHOD_CALL if not specified
            flags: DBusMessageFlags.REPLY_EXPECTED, // Default to expecting a reply
            protocolVersion: 1, // DBus protocol version, default to 1
            serial: 1, // Default serial number for message identification
            destination: '', // Destination bus name, empty by default
            path: '', // Object path, empty by default
            interfaceName: '', // Interface name, empty by default
            member: '', // Method or signal name, empty by default
            signature: '', // Type signature for body, empty by default
            sender: '', // Sender bus name, empty by default
            ...header // Override defaults with provided values
        }
        this.body = [...body] // Copy provided body arguments into the message
    }

    /**
     * Converts the DBus message instance to a Buffer for transmission.
     * Encodes the header and body into a binary format following the DBus wire protocol.
     * Ensures proper alignment and padding as required by the specification, including
     * an 8-byte boundary for the total header length.
     *
     * @returns A Buffer containing the encoded DBus message ready to be sent over the wire.
     * @throws {SerialError} If the message serial number is missing or invalid.
     */
    public toBuffer(): Buffer {
        if (!this.header.serial) throw new SerialError('Missing or invalid serial')
        const flags: DBusMessageFlags = this.header.flags || DBusMessageFlags.REPLY_EXPECTED
        const type: DBusMessageType = this.header.type || DBusMessageType.METHOD_CALL
        let bodyLength: number = 0
        let bodyBuff: Buffer = Buffer.alloc(0)
        if (this.header.signature && this.body.length > 0) {
            const bodyEncoder: DBusBufferEncoder = new DBusBufferEncoder(this.endianness)
            // Encode the body based on the signature; handle single vs. multiple arguments
            bodyBuff = bodyEncoder.encode(this.header.signature, this.body.length > 1 ? this.body : this.body[0])
            bodyLength = bodyBuff.length
        }
        // Create header fields array for encoding additional metadata
        const fields: any[] = []
        DBusMessage.headerTypeName.forEach((fieldName: string | null): void => {
            if (fieldName && this.header[fieldName]) {
                fields.push([
                    DBusMessage.headerTypeId[fieldName], // Assign the correct type ID for the field
                    new DBusSignedValue(DBusMessage.fieldSignature[fieldName], this.header[fieldName]) // Wrap the field value with its signature
                ])
            }
        })
        // Build basic header with only 12 bytes (without headerFieldsLength)
        const headerBasic: number[] = [
            DBusMessageEndianness.LE, // Endianness indicator
            type, // Message type
            flags, // Message flags
            this.header.protocolVersion, // Protocol version
            bodyLength, // Length of the body in bytes
            this.header.serial // Serial number for message tracking
        ]
        const headerAndFieldsEncoder: DBusBufferEncoder = new DBusBufferEncoder(this.endianness)
        const headerAndFieldsBuffer: Buffer = headerAndFieldsEncoder.encode('yyyyuua(yv)', [...headerBasic, fields])
        const totalHeaderLen: number = headerAndFieldsBuffer.length
        const headerLenAligned: number = Math.ceil(totalHeaderLen / 8) * 8
        const paddingLen: number = headerLenAligned - totalHeaderLen
        const paddingBuff: Buffer = Buffer.alloc(paddingLen, 0) // Add padding bytes to align to 8-byte boundary
        return Buffer.concat([headerAndFieldsBuffer, paddingBuff, bodyBuff])
    }

    /**
     * Retrieves the data (body) of the DBus message.
     * Returns the payload or arguments contained in the message as an array.
     *
     * @returns An array of data elements from the message body.
     */
    public data(): any[] {
        return this.body
    }

    /**
     * A static array mapping header field type IDs to their corresponding names.
     * Used for encoding and decoding header fields in DBus messages.
     * Null at index 0 as type IDs start from 1 in the DBus protocol.
     */
    protected static readonly headerTypeName: (string | null)[] = [
        null,
        'path',
        'interfaceName',
        'member',
        'errorName',
        'replySerial',
        'destination',
        'sender',
        'signature'
    ]

    /**
     * A static record mapping header field names to their type IDs.
     * Used during encoding to assign the correct type ID to each header field
     * as defined by the DBus specification.
     */
    protected static readonly headerTypeId: Record<string, number> = {
        path: 1,
        interfaceName: 2,
        member: 3,
        errorName: 4,
        replySerial: 5,
        destination: 6,
        sender: 7,
        signature: 8
    }

    /**
     * A static record mapping header field names to their DBus type signatures.
     * Used to encode header field values with the correct DBus type during message creation.
     */
    protected static readonly fieldSignature: Record<string, string> = {
        path: 'o',          // Object path
        interfaceName: 's',  // String (interface name)
        member: 's',         // String (method or signal name)
        errorName: 's',      // String (error name)
        replySerial: 'u',    // Unsigned integer (reply serial number)
        destination: 's',    // String (destination bus name)
        sender: 's',         // String (sender bus name)
        signature: 'g'       // Signature (type signature for body)
    }

    /**
     * Encodes a DBus message from a partial header and body data into a Buffer.
     * Static utility method to create and encode a message without instantiating it permanently.
     * Provides a convenient way to build a message with defaults and serialize it directly.
     *
     * @param header - A partial DBus message header with fields like type, flags, and serial.
     * @param body - Variable number of arguments representing the message body (payload data).
     * @returns A Buffer containing the encoded DBus message ready for transmission.
     */
    public static encode(header: Partial<DBusMessageHeader>, ...body: any[]): Buffer {
        const message: DBusMessage = new DBusMessage({
            type: DBusMessageType.METHOD_CALL,
            flags: DBusMessageFlags.REPLY_EXPECTED,
            protocolVersion: 1,
            serial: 1,
            destination: '',
            path: '',
            interfaceName: '',
            member: '',
            signature: '',
            sender: '',
            ...header // Override defaults with provided header fields
        }, ...body)
        return message.toBuffer()
    }

    /**
     * Decodes a DBus message from raw buffers into a DBusMessage instance.
     * Parses the header and body from binary data following the DBus wire protocol.
     * Handles endianness, header fields, padding, and body decoding based on the signature.
     *
     * @param header - A Buffer containing the initial 16 bytes of the DBus message header.
     * @param fieldsAndBody - A Buffer containing the header fields and body data.
     * @param fieldsLength - The length of the header fields section in bytes.
     * @param bodyLength - The length of the body section in bytes.
     * @returns A DBusMessage instance with parsed header and body content.
     */
    public static decode(header: Buffer, fieldsAndBody: Buffer, fieldsLength: number, bodyLength: number): DBusMessage {
        // Determine the endianness from the first byte of the header
        const endianness: DBusMessageEndianness = header[0] === DBusMessageEndianness.LE ? DBusMessageEndianness.LE : DBusMessageEndianness.BE
        const headerDecoder: DBusBufferDecoder = new DBusBufferDecoder(endianness, header)
        const headers: number[] = headerDecoder.decode('yyyyuuu')
        const type: number = headers[1] // Message type (e.g., METHOD_CALL, SIGNAL)
        const flags: number = headers[2] // Message flags (e.g., REPLY_EXPECTED)
        const protocolVersion: number = headers[3] // Protocol version
        const serial: number = headers[5] // Serial number for message tracking
        // Concatenate remaining header bytes with fields data for full field parsing
        const headerWithFieldsBuffer: Buffer = Buffer.concat([header, fieldsAndBody.subarray(0, fieldsLength)])
        const fieldsDecoder: DBusBufferDecoder = new DBusBufferDecoder(endianness, headerWithFieldsBuffer, 12)
        const [fields] = fieldsDecoder.decode('a(yv)') // Decode array of (type ID, value) pairs for header fields
        const messageHeader: Partial<DBusMessageHeader> = {
            type: type,
            flags: flags,
            protocolVersion: protocolVersion,
            serial: serial
        }
        // Map decoded field type IDs to header field names and assign values
        for (const field of (fields as [number, string | number][])) {
            const [typeId, fieldValue] = field
            const headerTypeName: string | null = this.headerTypeName[typeId]
            if (!headerTypeName) continue
            messageHeader[headerTypeName] = fieldValue
        }
        // If there is no body or no signature, return message with only header
        if (!bodyLength || !messageHeader.signature) return new DBusMessage(messageHeader)
        // Calculate aligned offset before body to account for padding (must align to 8-byte boundary)
        let paddingLength: number = 8 - (header.length + fieldsLength) % 8
        paddingLength = paddingLength === 8 ? 0 : paddingLength
        const bodyOffset: number = fieldsLength + paddingLength
        const bodyBuffer: Buffer = fieldsAndBody.subarray(bodyOffset)
        const bodyDecoder: DBusBufferDecoder = new DBusBufferDecoder(endianness, bodyBuffer)
        // Decode the body based on the signature provided in the header
        const body: any[] = bodyDecoder.decode(messageHeader.signature)
        return new DBusMessage(messageHeader, ...body)
    }
}
