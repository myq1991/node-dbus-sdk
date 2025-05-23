import {DBusMessageHeader} from '../types/DBusMessageHeader'
import {DBusMessageType} from './DBusMessageType'
import {DBusMessageFlags} from './DBusMessageFlags'
import {SerialError} from './Errors'
import {DBusMessageEndianness} from './DBusMessageEndianness'
import {DBusBufferEncoder} from './DBusBufferEncoder'
import {DBusSignedValue} from './DBusSignedValue'
import {DBusBufferDecoder} from './DBusBufferDecoder'

export class DBusMessage {

    public readonly endianness: DBusMessageEndianness = DBusMessageEndianness.LE

    public readonly header: DBusMessageHeader

    public readonly body: any[] = []

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
     * DBus message to buffer
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
        // Create header fields array
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
        // Combine header, fields, padding, and body
        return Buffer.concat([headerBuffer, fieldsBuff, paddingBuff, bodyBuff])
    }

    /**
     * Get data from message
     */
    public data(): any[] {
        return this.body
    }

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

    protected static readonly fieldSignature: Record<string, string> = {
        path: 'o',
        interfaceName: 's',
        member: 's',
        errorName: 's',
        replySerial: 'u',
        destination: 's',
        sender: 's',
        signature: 'g'
    }

    /**
     * Encode message instance to buffer
     * @param header
     * @param body
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
     * Decode message instance from buffer
     * @param header
     * @param fieldsAndBody
     * @param fieldsLength
     * @param bodyLength
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
        //Calculate aligned offset before body
        const bodyOffset: number = fieldsLength + (8 - (header.length + fieldsLength) % 8)
        const bodyDecoder: DBusBufferDecoder = new DBusBufferDecoder(endianness, fieldsAndBody.subarray(bodyOffset))
        const body: any[] = bodyDecoder.decode(messageHeader.signature)
        return new DBusMessage(messageHeader, ...body)
    }
}
