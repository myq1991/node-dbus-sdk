import {DBusMessageHeader} from '../types/DBusMessageHeader'
import {DBusMessageType} from './DBusMessageType'
import {DBusMessageFlags} from './DBusMessageFlags'
import {DataType} from '../types/DataType'
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
        if (this.header.signature && this.body) {
            bodyBuff = new DBusBuffer().write(this.header.signature, this.body).toBuffer()
            bodyLength = bodyBuff.length
        }
        const header: number[] = [
            DBusMessageEndianness.LE,
            type,
            flags,
            this.header.protocolVersion,
            bodyLength,
            this.header.serial
        ]
        const headerBuffer: Buffer = new DBusBuffer().write('yyyyuu', header).toBuffer()
        console.log('headerBuffer-len:', headerBuffer.length, headerBuffer)
        const fields: any[] = []
        const $fields = {}
        DBusMessage.headerTypeName.forEach((fieldName: string | null): void => {
            const fieldVal: string | number | undefined = this.header[fieldName!]
            if (fieldVal) {
                fields.push([
                    DBusMessage.headerTypeId[fieldName!],
                    // [DBusMessage.fieldSignature[fieldName!], fieldVal]
                    new DBusTypedValue(DBusMessage.fieldSignature[fieldName!], fieldVal)
                    // {_signature:DBusMessage.fieldSignature[fieldName!],value:fieldVal}
                    // fieldVal//TODO
                ])
                $fields[DBusMessage.headerTypeId[fieldName!]] = new DBusTypedValue(DBusMessage.fieldSignature[fieldName!], fieldVal)
            }
        })
        console.log('fields:', fields)
        const fieldsBuffer: Buffer = Buffer.concat([Buffer.alloc(12, 0), new DBusBuffer().write('a(yv)', fields).toBuffer()])
        // console.log(JSON.stringify(Array.from(new DBusBuffer().write('a(yv)', fields).toBuffer())))
        console.log('++++++1', new DBusBuffer().write('a(yv)', fields).toBuffer())
        console.log('++++++2', new DBusBuffer().write('a{yv})', [$fields]).toBuffer())
        console.log(new DBusBuffer(new DBusBuffer().write('a(yv)', fields).toBuffer()).read('a(yv)'))
        // const buf=Buffer.from([109,0,0,0,1,1,111,0,21,0,0,0,47,111,114,103,47,102,114,101,101,100,101,115,107,116,111,112,47,68,66,117,115,0,0,0,2,1,115,0,20,0,0,0,111,114,103,46,102,114,101,101,100,101,115,107,116,111,112,46,68,66,117,115,0,0,0,0,3,1,115,0,5,0,0,0,72,101,108,108,111,0,0,0,6,1,115,0,20,0,0,0,111,114,103,46,102,114,101,101,100,101,115,107,116,111,112,46,68,66,117,115,0])
        // console.log('buf:',buf)
        // console.log(new DBusBuffer(buf).read('a(yv)'))
        console.log('fieldsBuffer-len:', fieldsBuffer.length, fieldsBuffer)
        return Buffer.concat([headerBuffer, new DBusBuffer().write('a(yv)', fields).toBuffer()])
        // const headerLenAligned = ((headerBuffer.length + fieldsBuffer.length + 7) >> 3) << 3
        // const messageLen: number = headerLenAligned + bodyLength
        // const messageBuff: Buffer = Buffer.alloc(messageLen)
        // headerBuffer.copy(messageBuff)
        // fieldsBuffer.copy(messageBuff, fieldsBuffer.length)
        // if (bodyLength > 0) bodyBuff.copy(messageBuff, headerLenAligned)
        // return messageBuff
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

    public static readonly headerSignature: DataType[] = [
        {
            type: 'a',
            child: [{
                type: '(',
                child: [
                    {type: 'y', child: []},
                    {type: 'v', child: []}
                ]
            }]
        }
    ]

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

        return new DBusMessage(this.mapToDBusMessageHeader(message.header), message.body)

        // console.log(JSON.stringify(Array.from(Buffer.concat([header,fieldsAndBody]))))
        // // const messageBuffer: DBusBuffer = new DBusBuffer(header)
        // const messageBuffer: DBusBuffer = new DBusBuffer(Buffer.concat([header,fieldsAndBody]))
        // const unmarshalledHeader: any = messageBuffer.readArray(
        //     this.headerSignature![0]!.child![0]!,
        //     fieldsLength
        // )
        // // messageBuffer.align(3)
        // let headerName: string | null
        // const messageHeader: Partial<DBusMessageHeader> = {}
        // messageHeader.serial = header.readUInt32LE(8)
        // for (let i: number = 0; i < unmarshalledHeader.length; ++i) {
        //     headerName = this.headerTypeName[unmarshalledHeader[i][0]]
        //     messageHeader[headerName!] = unmarshalledHeader[i][1]
        // }
        // messageHeader.type = header[1]
        // messageHeader.flags = header[2]
        // return (bodyLength > 0 && messageHeader.signature) ? new DBusMessage(messageHeader, messageBuffer.read(messageHeader.signature)) : new DBusMessage(messageHeader)
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