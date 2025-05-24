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
 */
export class DBusMessage {

    /**
     * The endianness used for encoding and decoding DBus messages.
     * Defaults to little-endian (LE) as it is the most common in DBus implementations.
     */
    public readonly endianness: DBusMessageEndianness = DBusMessageEndianness.LE

    /**
     * The header of the DBus message.
     * Contains metadata such as message type, flags, serial number, and other fields like path and interface.
     */
    public readonly header: DBusMessageHeader

    /**
     * The body of the DBus message.
     * Contains the payload or arguments of the message, such as method parameters or signal data.
     */
    public readonly body: any[] = []

    /**
     * Constructor for creating a DBusMessage instance.
     * Initializes the message with a header and optional body content, applying default values for required fields.
     *
     * @param header - The message header or partial header object, with fields like type, flags, and serial.
     * @param body - Variable number of arguments representing the message body (payload data).
     */
    constructor(header: DBusMessageHeader | Partial<DBusMessageHeader>, ...body: any[]) {
        this.header = {
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
            ...header
        }
        this.body = [...body]
    }

    /**
     * Converts the DBus message instance to a Buffer for transmission.
     * Encodes the header and body into a binary format following the DBus wire protocol.
     * Ensures proper alignment and padding as required by the specification.
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
            bodyBuff = bodyEncoder.encode(this.header.signature, this.body.length > 1 ? this.body : this.body[0])
            bodyLength = bodyBuff.length
        }
        // Create header fields array for encoding additional metadata
        const fields: any[] = []
        DBusMessage.headerTypeName.forEach((fieldName: string | null): void => {
            if (fieldName && this.header[fieldName]) {
                fields.push([
                    DBusMessage.headerTypeId[fieldName],
                    new DBusSignedValue(DBusMessage.fieldSignature[fieldName], this.header[fieldName])
                ])
            }
        })
        const fieldsEncoder: DBusBufferEncoder = new DBusBufferEncoder(this.endianness)
        const fieldsBuff: Buffer = fieldsEncoder.encode('a(yv)', fields)
        // Build basic header with only 12 bytes (without headerFieldsLength)
        const headerBasic: number[] = [
            DBusMessageEndianness.LE,
            type,
            flags,
            this.header.protocolVersion,
            bodyLength,
            this.header.serial
        ]
        const headerEncoder: DBusBufferEncoder = new DBusBufferEncoder(this.endianness)
        const headerBuffer: Buffer = headerEncoder.encode('yyyyuu', headerBasic)
        // Calculate total header length (headerBuffer + fieldsBuff) and align to 8-byte boundary
        const totalHeaderLen: number = headerBuffer.length + fieldsBuff.length
        const headerLenAligned: number = Math.ceil(totalHeaderLen / 8) * 8
        const paddingLen: number = headerLenAligned - totalHeaderLen
        const paddingBuff: Buffer = Buffer.alloc(paddingLen, 0)
        // Combine header, fields, padding, and body into a single buffer
        return Buffer.concat([headerBuffer, fieldsBuff, paddingBuff, bodyBuff])
    }

    /**
     * Retrieves the data (body) of the DBus message.
     * Returns the payload or arguments contained in the message.
     *
     * @returns An array of data elements from the message body.
     */
    public data(): any[] {
        return this.body
    }

    /**
     * A static array mapping header field type IDs to their corresponding names.
     * Used for encoding and decoding header fields in DBus messages.
     * Null at index 0 as type IDs start from 1.
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
     * Used during encoding to assign the correct type ID to each header field.
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
            ...header
        }, ...body)
        return message.toBuffer()
    }

    /**
     * Decodes a DBus message from raw buffers into a DBusMessage instance.
     * Parses the header and body from binary data following the DBus wire protocol.
     * Handles endianness, header fields, padding, and body decoding based on signature.
     *
     * @param header - A Buffer containing the initial 16 bytes of the DBus message header.
     * @param fieldsAndBody - A Buffer containing the header fields and body data.
     * @param fieldsLength - The length of the header fields section in bytes.
     * @param bodyLength - The length of the body section in bytes.
     * @returns A DBusMessage instance with parsed header and body content.
     */
    public static decode(header: Buffer, fieldsAndBody: Buffer, fieldsLength: number, bodyLength: number): DBusMessage {
        const endianness: DBusMessageEndianness = header[0] === DBusMessageEndianness.LE ? DBusMessageEndianness.LE : DBusMessageEndianness.BE
        const headerDecoder: DBusBufferDecoder = new DBusBufferDecoder(endianness, header)
        const headers: number[] = headerDecoder.decode('yyyyuuu')
        const type: number = headers[1]
        const flags: number = headers[2]
        const protocolVersion: number = headers[3]
        const serial: number = headers[5]
        const fulfillFieldsBuffer: Buffer = Buffer.concat([header.subarray(12), fieldsAndBody.subarray(0, fieldsLength)])
        const fieldsDecoder: DBusBufferDecoder = new DBusBufferDecoder(endianness, fulfillFieldsBuffer)
        const [fields] = fieldsDecoder.decode('a(yv)')
        const messageHeader: Partial<DBusMessageHeader> = {
            type: type,
            flags: flags,
            protocolVersion: protocolVersion,
            serial: serial
        }
        for (const field of (fields as [number, string | number][])) {
            const [typeId, fieldValue] = field
            const headerTypeName: string | null = this.headerTypeName[typeId]
            if (!headerTypeName) continue
            messageHeader[headerTypeName] = fieldValue
        }
        if (!bodyLength || !messageHeader.signature) return new DBusMessage(messageHeader)
        // Calculate aligned offset before body to account for padding
        const bodyOffset: number = fieldsLength + (8 - (header.length + fieldsLength) % 8)
        const bodyDecoder: DBusBufferDecoder = new DBusBufferDecoder(endianness, fieldsAndBody.subarray(bodyOffset))
        const body: any[] = bodyDecoder.decode(messageHeader.signature)
        return new DBusMessage(messageHeader, ...body)
    }
}
