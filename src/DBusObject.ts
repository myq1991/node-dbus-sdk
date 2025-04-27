import {MessageBus} from './MessageBus'
import {messageType} from './lib/Constants'
import {parseStringPromise as parseXMLString} from 'xml2js'
import {As} from './lib/Helpers'
import {IntrospectInterface} from './types/IntrospectTypes'
import {DBusInterface} from './DBusInterface'

export class DBusObject {

    readonly #interfaces: Map<string, DBusInterface> = new Map()

    public readonly service: string

    public readonly name: string

    public readonly bus: MessageBus

    constructor(service: string, objectPath: string, bus: MessageBus) {
        this.service = service
        this.name = objectPath
        this.bus = bus
    }

    /**
     * Init object
     */
    public async init(): Promise<this> {
        await this.reload()
        return this
    }

    /**
     * Reload object
     * @protected
     */
    protected async reload(): Promise<void> {
        this.#interfaces.clear()
        let introspectXML: string
        [introspectXML] = await this.bus.invoke({
            type: messageType.methodCall,
            member: 'Introspect',
            path: this.name,
            destination: this.service,
            interface: 'org.freedesktop.DBus.Introspectable'
        })
        const introspectObject: any = await parseXMLString(introspectXML)
        if (!introspectObject.node.interface) throw new Error(`object ${this.name} not found`)
        const introspectInterface: IntrospectInterface[] = As<IntrospectInterface[]>(introspectObject.node.interface)
        introspectInterface.forEach((introspectInterface: IntrospectInterface): void => {
            this.#interfaces.set(introspectInterface.$.name, new DBusInterface(this.service, this.name, introspectInterface.$.name, introspectInterface, this.bus))
        })
    }

    /**
     * Get interface
     * @param name
     */
    public getInterface(name: string): DBusInterface {
        const dbusInterface: DBusInterface | undefined = this.#interfaces.get(name)
        if (!dbusInterface) throw new Error(`interface ${name} not found`)
        return dbusInterface
    }

    /**
     * List interfaces
     */
    public listInterfaces(): string[] {
        return [...this.#interfaces.keys()]
    }
}