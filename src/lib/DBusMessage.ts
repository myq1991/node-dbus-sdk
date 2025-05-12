import {DBusMessageHeader} from '../types/DBusMessageHeader'
import {DBusMessageType} from './DBusMessageType'
import {DBusMessageFlags} from './DBusMessageFlags'
import {DataType} from '../types/DataType'
import {DBusBuffer} from './DBusBuffer'

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
        //TODO
        return Buffer.from([])
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
        'interface',
        'member',
        'errorName',
        'replySerial',
        'destination',
        'sender',
        'signature'
    ]

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
        const messageBuffer: DBusBuffer = new DBusBuffer(fieldsAndBody)
        const unmarshalledHeader: any = messageBuffer.readArray(
            this.headerSignature![0]!.child![0]!,
            fieldsLength
        )
        // messageBuffer.align(3)
        let headerName: string | null
        const messageHeader: Partial<DBusMessageHeader> = {}
        messageHeader.serial = header.readUInt32LE(8)
        for (let i: number = 0; i < unmarshalledHeader.length; ++i) {
            headerName = this.headerTypeName[unmarshalledHeader[i][0]]
            messageHeader[headerName!] = unmarshalledHeader[i][1]
        }
        messageHeader.type = header[1]
        messageHeader.flags = header[2]
        return (bodyLength > 0 && messageHeader.signature) ? new DBusMessage(messageHeader, messageBuffer.read(messageHeader.signature)) : new DBusMessage(messageHeader)
    }
}