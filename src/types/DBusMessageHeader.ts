import {DBusMessageType} from '../lib/DBusMessageType'
import {DBusMessageFlags} from '../lib/DBusMessageFlags'

export interface DBusMessageHeader {
    type: DBusMessageType
    flags: DBusMessageFlags
    protocolVersion: number
    serial: number
    destination: string
    path: string
    interfaceName: string
    member: string
    signature: string
    sender: string
    replySerial?: number
    errorName?: string
}