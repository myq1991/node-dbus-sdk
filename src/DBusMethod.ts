import {MessageBus} from './MessageBus'
import {DBusMethodArgumentDirection, IDBusMethodArgument} from './types/IDBusMethodArgument'
import {IDBusMessage} from './types/IDBusMessage'

export class DBusMethod {

    public readonly service: string

    public readonly objectPath: string

    public readonly interface: string

    public readonly name: string

    public readonly bus: MessageBus

    public readonly args: IDBusMethodArgument[]

    protected readonly inputSignature: string

    constructor(service: string, objectPath: string, iface: string, method: string, args: IDBusMethodArgument[], bus: MessageBus) {
        this.service = service
        this.objectPath = objectPath
        this.interface = iface
        this.name = method
        this.args = args
        this.bus = bus
        this.inputSignature = this.args
            .filter((arg: IDBusMethodArgument): boolean => arg.direction === DBusMethodArgumentDirection.IN)
            .map((arg: IDBusMethodArgument): string => arg.type)
            .join()
    }

    /**
     * Call method
     * @param args
     */
    public async call(...args: any[]): Promise<any> {
        const message: IDBusMessage = {
            destination: this.service,
            path: this.objectPath,
            interface: this.interface,
            member: this.name
        }
        if (this.inputSignature) {
            message.signature = this.inputSignature
            message.body = args
        }
        return await this.bus.invoke(message)
    }
}