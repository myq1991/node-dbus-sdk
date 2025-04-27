import {MessageBus} from './MessageBus'
import {messageType} from './lib/Constants'
import {parseStringPromise as parseXMLString} from 'xml2js'
import {As} from './lib/Helpers'
import {DBusMethod} from './DBusMethod'
import {DBusProperty} from './DBusProperty'
import {DBusMethodArgumentDirection, IDBusMethodArgument} from './types/IDBusMethodArgument'
import {DBusSignal} from './DBusSignal'
import {IDBusSignalArgument} from './types/IDBusSignalArgument'

type IntrospectInterface = {
    $: { name: string }
    method?: IntrospectInterfaceMethod[]
    signal?: IntrospectInterfaceSignal[]
    property?: IntrospectInterfaceProperty[]
}

type IntrospectInterfaceMethod = {
    $: { name: string }
    arg?: IntrospectInterfaceMethodArg[]
}

type IntrospectInterfaceMethodArg = {
    $: {
        type: string
        name: string
        direction: string
    }
}

type IntrospectInterfaceSignal = {
    $: { name: string }
    arg?: IntrospectInterfaceSignalArg[]
}

type IntrospectInterfaceSignalArg = {
    $: {
        type: string
        name: string
    }
}

type IntrospectInterfaceProperty = {
    $: {
        type: string
        name: string
        access: string
    }
}

export class DBusInterface {

    readonly #methods: Map<string, DBusMethod> = new Map()

    readonly #properties: Map<string, DBusProperty> = new Map()

    readonly #signals: Map<string, DBusSignal> = new Map()

    public readonly service: string

    public readonly objectPath: string

    public readonly name: string

    public readonly bus: MessageBus

    public get methods(): Record<string, DBusMethod> {
        return Object.fromEntries(this.#methods)
    }

    public get properties(): Record<string, DBusProperty> {
        return Object.fromEntries(this.#properties)

    }

    public get signals(): Record<string, DBusSignal> {
        return Object.fromEntries(this.#signals)
    }

    constructor(service: string, objectPath: string, iface: string, bus: MessageBus) {
        this.service = service
        this.objectPath = objectPath
        this.name = iface
        this.bus = bus
    }

    public async init(): Promise<this> {
        await this.reload()
        return this
    }

    protected async reload(): Promise<void> {
        let introspectXML: string
        [introspectXML] = await this.bus.invoke({
            type: messageType.methodCall,
            member: 'Introspect',
            path: this.objectPath,
            destination: this.service,
            interface: 'org.freedesktop.DBus.Introspectable'
        })
        const introspectObject: any = await parseXMLString(introspectXML)
        const introspectInterface: IntrospectInterface | undefined = As<IntrospectInterface[]>(introspectObject.node.interface).find((iface: IntrospectInterface): boolean => iface.$.name === this.name)
        this.#methods.clear()
        this.#properties.clear()
        this.#signals.clear()
        if (!introspectInterface) return
        introspectInterface.method
            ?.map((method: IntrospectInterfaceMethod): DBusMethod => {
                const args: IDBusMethodArgument[] = method.arg ? method.arg.map((arg: IntrospectInterfaceMethodArg): IDBusMethodArgument => ({
                    type: arg.$.type,
                    name: arg.$.name,
                    direction: As<DBusMethodArgumentDirection>(arg.$.direction)
                })) : []
                return new DBusMethod(this.service, this.objectPath, this.name, method.$.name, args, this.bus)
            })
            .forEach((dbusMethod: DBusMethod): void => {
                this.#methods.set(dbusMethod.name, dbusMethod)
            })
        introspectInterface.property
            ?.map((property: IntrospectInterfaceProperty): DBusProperty => new DBusProperty(this.service, this.objectPath, this.name, property.$.name, property.$.type, property.$.access, this.bus))
            .forEach((dbusProperty: DBusProperty): void => {
                this.#properties.set(dbusProperty.name, dbusProperty)
            })
        introspectInterface.signal
            ?.map((signal: IntrospectInterfaceSignal): DBusSignal => {
                const args: IDBusSignalArgument[] = signal.arg ? signal.arg.map((arg: IntrospectInterfaceSignalArg): IDBusSignalArgument => ({
                    name: arg.$.name,
                    type: arg.$.type
                })) : []
                return new DBusSignal(this.service, this.objectPath, this.name, signal.$.name, args, this.bus)
            })
            .forEach((dBusSignal: DBusSignal): void => {
                this.#signals.set(dBusSignal.name, dBusSignal)
            })
    }
}