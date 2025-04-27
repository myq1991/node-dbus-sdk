import {MessageBus} from './MessageBus'

export class DBusInterface {

    public readonly service: string

    public readonly objectPath: string

    public readonly name: string

    public readonly bus: MessageBus

    constructor(service: string, objectPath: string, iface: string, bus: MessageBus) {
        this.service = service
        this.objectPath = objectPath
        this.name = iface
        this.bus = bus
    }
}