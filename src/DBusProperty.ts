import {MessageBus} from './MessageBus'

export class DBusProperty {

    public readonly service: string

    public readonly objectPath: string

    public readonly interface: string

    public readonly name: string

    public readonly type: string

    public readonly bus: MessageBus

    constructor(service: string, objectPath: string, iface: string, property: string, type: string, bus: MessageBus) {
        this.service = service
        this.objectPath = objectPath
        this.interface = iface
        this.name = property
        this.type = type
        this.bus = bus
    }

    /**
     * Get property value
     */
    public async get(): Promise<any> {
        const value: any = await this.bus.invoke({
            destination: this.service,
            path: this.objectPath,
            interface: 'org.freedesktop.DBus.Properties',
            member: 'Get',
            signature: 'ss',
            body: [this.interface, this.name]
        })
        return Array.isArray(value) && value.length == 1 ? value[0] : value
    }

    /**
     * Set property value
     * @param value
     */
    public async set(value: any): Promise<void> {
        await this.bus.invoke({
            destination: this.service,
            path: this.objectPath,
            interface: 'org.freedesktop.DBus.Properties',
            member: 'Set',
            signature: 'ssv',
            body: [this.interface, this.name, [this.type, value]]
        })
    }
}