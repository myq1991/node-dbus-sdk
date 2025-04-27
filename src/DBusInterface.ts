import {MessageBus} from './MessageBus'
import {As} from './lib/Helpers'
import {DBusMethod} from './DBusMethod'
import {DBusProperty} from './DBusProperty'
import {DBusMethodArgumentDirection, IDBusMethodArgument} from './types/IDBusMethodArgument'
import {DBusSignal} from './DBusSignal'
import {IDBusSignalArgument} from './types/IDBusSignalArgument'
import {
    IntrospectInterface,
    IntrospectInterfaceMethod,
    IntrospectInterfaceMethodArg,
    IntrospectInterfaceProperty,
    IntrospectInterfaceSignal,
    IntrospectInterfaceSignalArg
} from './types/IntrospectTypes'


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

    constructor(service: string, objectPath: string, iface: string, introspectInterface: IntrospectInterface, bus: MessageBus) {
        this.service = service
        this.objectPath = objectPath
        this.name = iface
        this.bus = bus
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