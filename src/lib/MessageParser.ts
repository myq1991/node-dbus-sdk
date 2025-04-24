import {Duplex} from 'node:stream'
import {IDBusBufferOptions} from '../types/IDBusBufferOptions'
import {DBusBuffer} from './DBusBuffer'
import {IType} from '../types/IType'
import {IDBusMessage} from '../types/IDBusMessage'
import {endianness, fieldSignature, headerTypeId, headerTypeName, messageType, protocolVersion} from './Constants'
import {marshall} from './Marshall'

export class MessageParser {
    protected readonly headerSignature: IType[] = [
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

    public parse(stream: Duplex, onMessage: (msg: IDBusMessage) => void, options?: IDBusBufferOptions): void {
        let state: number = 0 // 0: header, 1: fields + body
        let header: Buffer
        let fieldsAndBody: Buffer
        let fieldsLength: number
        let fieldsLengthPadded: number
        let fieldsAndBodyLength: number = 0
        let bodyLength: number = 0
        stream.on('readable', (): void => {
            while (1) {
                if (state === 0) {
                    header = stream.read(16)
                    if (!header) break
                    state = 1
                    fieldsLength = header.readUInt32LE(12)
                    fieldsLengthPadded = ((fieldsLength + 7) >> 3) << 3
                    bodyLength = header.readUInt32LE(4)
                    fieldsAndBodyLength = fieldsLengthPadded + bodyLength
                } else {
                    fieldsAndBody = stream.read(fieldsAndBodyLength)
                    if (!fieldsAndBody) break
                    state = 0

                    let messageBuffer: DBusBuffer = new DBusBuffer(fieldsAndBody, undefined, options)
                    let unmarshalledHeader = messageBuffer.readArray(
                        this.headerSignature![0]!.child![0]!,
                        fieldsLength
                    )
                    messageBuffer.align(3)
                    let headerName: string | null
                    let message: IDBusMessage = {}
                    message.serial = header.readUInt32LE(8)

                    for (let i = 0; i < unmarshalledHeader.length; ++i) {
                        headerName = headerTypeName[unmarshalledHeader[i][0]]
                        if (typeof options?.simple !== 'undefined' && !options?.simple) {
                            message[headerName!] = unmarshalledHeader[i][1][1][0]
                        } else {
                            message[headerName!] = unmarshalledHeader[i][1]
                        }
                    }

                    message.type = header[1]
                    message.flags = header[2]

                    if (bodyLength > 0 && message.signature) {
                        message.body = messageBuffer.read(message.signature)
                    }
                    onMessage(message)
                }
            }
        })
    }

    public marshall(message: IDBusMessage): Buffer {
        if (!message.serial) throw new Error('Missing or invalid serial')
        let flags: number = message.flags || 0
        let type: number = message.type || messageType.methodCall
        let bodyLength: number = 0
        let bodyBuff: Buffer = Buffer.from([])
        if (message.signature && message.body) {
            bodyBuff = marshall(message.signature, message.body)
            bodyLength = bodyBuff.length
        }
        let header: number[] = [
            endianness.le,
            type,
            flags,
            protocolVersion,
            bodyLength,
            message.serial
        ]
        let headerBuff: Buffer = marshall('yyyyuu', header)
        let fields: any[] = []
        headerTypeName.forEach(function (fieldName) {
            let fieldVal = message[fieldName!]
            if (fieldVal) {
                fields.push([
                    headerTypeId[fieldName!],
                    [fieldSignature[fieldName!], fieldVal]
                ])
            }
        })
        let fieldsBuff: Buffer = marshall('a(yv)', [fields], 12)
        let headerLenAligned =
            ((headerBuff.length + fieldsBuff.length + 7) >> 3) << 3
        let messageLen: number = headerLenAligned + bodyLength
        let messageBuff: Buffer = Buffer.alloc(messageLen)
        headerBuff.copy(messageBuff)
        fieldsBuff.copy(messageBuff, headerBuff.length)
        if (bodyLength > 0) bodyBuff.copy(messageBuff, headerLenAligned)
        return messageBuff
    }
}