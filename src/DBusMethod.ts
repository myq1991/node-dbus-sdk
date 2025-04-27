import {MessageBus} from './MessageBus'

export class DBusMethod {

    public readonly service: string

    public readonly objectPath: string

    public readonly interface: string

    public readonly name: string

    public readonly bus: MessageBus

    constructor(service: string, objectPath: string, iface: string, method: string, bus: MessageBus) {
        this.service = service
        this.objectPath = objectPath
        this.interface = iface
        this.name = method
        this.bus = bus
    }
}