import {MessageBus} from './MessageBus'
import {IDBusSignalArgument} from './types/IDBusSignalArgument'

export class DBusSignal {

    public readonly service: string

    public readonly objectPath: string

    public readonly interface: string

    public readonly name: string

    public readonly args: IDBusSignalArgument[]

    public readonly bus: MessageBus

    constructor(service: string, objectPath: string, iface: string, property: string, args: IDBusSignalArgument[], bus: MessageBus) {
        this.service = service
        this.objectPath = objectPath
        this.interface = iface
        this.name = property
        this.args = args
        this.bus = bus
    }
}