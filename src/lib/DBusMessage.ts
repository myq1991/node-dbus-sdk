import {DBusMessageHeader} from '../types/DBusMessageHeader'
import {DBusMessageType} from './DBusMessageType'
import {DBusMessageFlags} from './DBusMessageFlags'
import {DBusBuffer} from './DBusBuffer'
import {SerialError} from './Errors'
import {DBusMessageEndianness} from './DBusMessageEndianness'
import {DBusTypedValue} from './DBusTypedValue'

export class DBusMessage {
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
        let bodyBuff: Buffer = Buffer.from([])
        if (this.header.signature && this.body.length > 0) {
            bodyBuff = new DBusBuffer().write(this.header.signature, this.body).toBuffer()
            bodyLength = bodyBuff.length
        }

        // Create header fields array
        const fields: any[] = []
        DBusMessage.headerTypeName.forEach((fieldName: string | null): void => {
            if (fieldName && this.header[fieldName]) {
                fields.push([
                    DBusMessage.headerTypeId[fieldName],
                    new DBusTypedValue(DBusMessage.fieldSignature[fieldName], this.header[fieldName])
                ])
            }
        })

        // Encode fields to calculate length
        const fieldsBuff = new DBusBuffer().write('a(yv)', fields).toBuffer()

        // Build basic header with only 12 bytes (without headerFieldsLength)
        const headerBasic: number[] = [
            DBusMessageEndianness.LE,
            type,
            flags,
            this.header.protocolVersion,
            bodyLength,
            this.header.serial
        ]
        const headerBuffer = new DBusBuffer().write('yyyyuu', headerBasic).toBuffer()

        // Calculate total header length (headerBuffer + fieldsBuff) and align to 8-byte boundary
        const totalHeaderLen = headerBuffer.length + fieldsBuff.length
        const headerLenAligned = Math.ceil(totalHeaderLen / 8) * 8
        const paddingLen = headerLenAligned - totalHeaderLen
        const paddingBuff = Buffer.alloc(paddingLen, 0)
        console.log('Debug: Calculated total header length', totalHeaderLen, 'aligned to', headerLenAligned, 'adding padding of', paddingLen, 'bytes')

        // Combine header, fields, padding, and body
        const finalMessage = Buffer.concat([headerBuffer, fieldsBuff, paddingBuff, bodyBuff])

        console.log('Generated headerBuffer Array:', JSON.stringify(Array.from(headerBuffer)), headerBuffer.length)
        console.log('Generated fieldsBuff Array:', JSON.stringify(Array.from(fieldsBuff)), fieldsBuff.length)
        console.log('Generated paddingBuff Array:', JSON.stringify(Array.from(paddingBuff)), paddingBuff.length)
        console.log('Generated bodyBuff Array:', JSON.stringify(Array.from(bodyBuff)), bodyBuff.length)
        console.log('Generated Buffer Array:', JSON.stringify(Array.from(finalMessage)), finalMessage.length)
        console.log('Generated Buffer:', finalMessage)
        return finalMessage
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
        const messageBuffer: DBusBuffer = new DBusBuffer(Buffer.concat([header, fieldsAndBody]))
        const message = messageBuffer.readMessage()
        return new DBusMessage(this.mapToDBusMessageHeader(message.header), message.body || [])
    }

    /**
     * Maps the raw header object from readMessage to a structured DBusMessageHeader interface.
     * @param header - The raw header object returned from readMessage.
     * @returns A DBusMessageHeader object populated with values from the header.
     */
    protected static mapToDBusMessageHeader(header: any): DBusMessageHeader {
        // Initialize default values for the header
        const messageHeader: DBusMessageHeader = {
            type: header.messageType as DBusMessageType,
            flags: header.flags as DBusMessageFlags,
            protocolVersion: header.protocolVersion,
            serial: header.serial,
            destination: '',
            path: '',
            interfaceName: '',
            member: '',
            signature: '',
            sender: ''
        }

        // Extract values from header fields based on field codes (as per DBus spec)
        for (const [fieldCode, fieldValue] of header.fields) {
            switch (fieldCode) {
                case 1: // DESTINATION
                    messageHeader.destination = typeof fieldValue === 'string' ? fieldValue : ''
                    break
                case 2: // PATH
                    messageHeader.path = typeof fieldValue === 'string' ? fieldValue : ''
                    break
                case 3: // INTERFACE
                    messageHeader.interfaceName = typeof fieldValue === 'string' ? fieldValue : ''
                    break
                case 4: // MEMBER
                    messageHeader.member = typeof fieldValue === 'string' ? fieldValue : ''
                    break
                case 5: // ERROR_NAME
                    messageHeader.errorName = typeof fieldValue === 'string' ? fieldValue : undefined
                    break
                case 6: // REPLY_SERIAL
                    messageHeader.replySerial = typeof fieldValue === 'number' ? fieldValue : undefined
                    break
                case 7: // SENDER
                    messageHeader.sender = typeof fieldValue === 'string' ? fieldValue : ''
                    break
                case 8: // SIGNATURE
                    messageHeader.signature = typeof fieldValue === 'string' ? fieldValue : ''
                    break
                default:
                    // Ignore unknown field codes
                    break
            }
        }

        return messageHeader
    }
}
