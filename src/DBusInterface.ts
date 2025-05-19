import {DBusInterfaceOpts} from './types/DBusInterfaceOpts'
import {DBus} from './DBus'
import {DBusService} from './DBusService'
import {DBusObject} from './DBusObject'
import {IntrospectInterface} from './types/IntrospectInterface'
import {IntrospectMethod} from './types/IntrospectMethod'
import {IntrospectProperty} from './types/IntrospectProperty'
import {IntrospectSignal} from './types/IntrospectSignal'
import {IntrospectMethodArgument} from './types/IntrospectMethodArgument'
import {ReplyModeMethodCall} from './types/ReplyModeMethodCall'
import {NoReplyModeMethodCall} from './types/NoReplyModeMethodCall'
import {PropertyOperation} from './types/PropertyOperation'
import {DBusPropertyAccess} from './lib/DBusPropertyAccess'
import {AccessPropertyForbiddenError} from './lib/Errors'
import {DBusSignalEmitter} from './lib/DBusSignalEmitter'

export class DBusInterface {

    #signalEmitter: DBusSignalEmitter

    protected readonly opts: DBusInterfaceOpts

    protected readonly dbus: DBus

    protected readonly service: DBusService

    protected readonly object: DBusObject

    protected readonly introspectInterface: IntrospectInterface

    public readonly name: string

    constructor(opts: DBusInterfaceOpts) {
        this.opts = opts
        this.name = this.opts.iface
        this.dbus = this.opts.dbus
        this.service = this.opts.dbusService
        this.object = this.opts.dbusObject
        this.introspectInterface = this.opts.introspectInterface
    }

    public get method(): Record<string, ReplyModeMethodCall> {
        const methods: Record<string, ReplyModeMethodCall> = {}
        this.listMethods().forEach((methodInfo: IntrospectMethod): void => {
            methods[methodInfo.name] = async (...args: any[]): Promise<any> => {
                const types: string[] = methodInfo.arg
                    .filter((arg: IntrospectMethodArgument): boolean => arg.direction === 'in')
                    .map((arg: IntrospectMethodArgument): string => arg.type)
                const result: any[] = await this.dbus.invoke({
                    service: this.service.name,
                    objectPath: this.object.name,
                    interface: this.name,
                    method: methodInfo.name,
                    signature: types.length ? types.join('') : undefined,
                    args: args
                })
                if (result.length > 1) return result
                return result[0]
            }
        })
        return methods
    }

    public get noReplyMethod(): Record<string, NoReplyModeMethodCall> {
        const noReplyMethods: Record<string, NoReplyModeMethodCall> = {}
        this.listMethods().forEach((methodInfo: IntrospectMethod): void => {
            noReplyMethods[methodInfo.name] = (...args: any[]): void => {
                const types: string[] = methodInfo.arg
                    .filter((arg: IntrospectMethodArgument): boolean => arg.direction === 'in')
                    .map((arg: IntrospectMethodArgument): string => arg.type)
                this.dbus.invoke({
                    service: this.service.name,
                    objectPath: this.object.name,
                    interface: this.name,
                    method: methodInfo.name,
                    signature: types.length ? types.join('') : undefined,
                    args: args
                }, true)
            }
        })
        return noReplyMethods
    }

    public get property(): Record<string, PropertyOperation> {
        const properties: Record<string, PropertyOperation> = {}
        this.listProperties().forEach((propertyInfo: IntrospectProperty): void => {
            properties[propertyInfo.name] = {
                set: async (value: any): Promise<void> => {
                    if (![DBusPropertyAccess.WRITE, DBusPropertyAccess.READWRITE].includes(propertyInfo.access)) throw new AccessPropertyForbiddenError(`Access to attribute ${propertyInfo.name} is prohibited, and its access mode is ${propertyInfo.access}`)
                    return this.dbus.setProperty({
                        service: this.service.name,
                        objectPath: this.object.name,
                        interface: this.name,
                        property: propertyInfo.name,
                        value: value
                    })
                },
                get: async (): Promise<any> => {
                    if (![DBusPropertyAccess.READ, DBusPropertyAccess.READWRITE].includes(propertyInfo.access)) throw new AccessPropertyForbiddenError(`Access to attribute ${propertyInfo.name} is prohibited, and its access mode is ${propertyInfo.access}`)
                    return this.dbus.getProperty({
                        service: this.service.name,
                        objectPath: this.object.name,
                        interface: this.name,
                        property: propertyInfo.name
                    })
                }
            }
        })
        return properties
    }

    public get signal(): DBusSignalEmitter {
        if (!this.#signalEmitter) this.#signalEmitter = this.dbus.createSignalEmitter({
            service: this.service.name,
            uniqueName: this.service.uniqueName,
            objectPath: this.object.name,
            interface: this.name
        })
        return this.#signalEmitter
    }

    public listMethods(): IntrospectMethod[] {
        return this.introspectInterface.method
    }

    public listProperties(): IntrospectProperty[] {
        return this.introspectInterface.property
    }

    public listSignals(): IntrospectSignal[] {
        return this.introspectInterface.signal
    }
}