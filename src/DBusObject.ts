import {DBusService} from './DBusService'
import {MessageBus} from './MessageBus'

export class DBusObject {

    public readonly service: string

    public readonly name: string

    public readonly bus: MessageBus


    constructor(service: string, objectPath: string, bus: MessageBus) {
        this.service = service
        this.name = objectPath
        this.bus = bus
    }

    public async introspect() {
        // const xml: string = await this.service.bus.invoke({
        //     destination: this.service.name,
        //     path: this.name,
        //     interface: 'org.freedesktop.DBus.Introspectable',
        //     member: 'Introspect'
        // })
        // if (!xml) throw new Error('unable to introspect')
    }
}