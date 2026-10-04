import {DBusInterfaceOpts} from './types/DBusInterfaceOpts'
import {DBus} from './DBus'
import {DBusService} from './DBusService'
import {DBusObject} from './DBusObject'
import {IntrospectInterface} from './types/IntrospectInterface'
import {IntrospectMethod} from './types/IntrospectMethod'
import {IntrospectProperty} from './types/IntrospectProperty'
import {IntrospectSignal} from './types/IntrospectSignal'
import {IntrospectMethodArgument} from './types/IntrospectMethodArgument'
import {MethodCall} from './types/MethodCall'
import {NoReplyMethodCall} from './types/NoReplyMethodCall'
import {PropertyOperation} from './types/PropertyOperation'
import {DBusPropertyAccess} from './lib/enums/DBusPropertyAccess'
import {AccessPropertyForbiddenError, NotEnoughParamsError} from './lib/Errors'
import {DBusSignalEmitter} from './lib/DBusSignalEmitter'
import {DBusSignedValue} from './lib/DBusSignedValue'
import {NamedMethodCall} from './types/NamedMethodCall'
import {NamedNoReplyMethodCall} from './types/NamedNoReplyMethodCall'

/**
 * A proxy for one interface of a remote object, built from its introspection data. Get one from DBus.getInterface or
 * DBusObject.getInterface. Methods, properties and signals are reached by name, and arguments take their types from
 * the introspected signatures, so plain JavaScript values are enough.
 *
 * @example
 * const iface = await dbus.getInterface('org.example.Greeter', '/org/example/Greeter', 'org.example.Greeter1')
 * const message = await iface.method.Greet('Alice')            // one return value: the value itself
 * const [count, since] = await iface.method.Stats()            // several: an array
 * await iface.namedMethod.Greet({name: 'Bob'})                 // arguments by name
 * iface.noReplyMethod.Ping()                                   // no reply expected
 * const greeting = await iface.property.Greeting.get()
 * await iface.property.Greeting.set('Howdy')
 * iface.signal.on('Greeted', (name, count) => console.log(name, count))
 */
export class DBusInterface {

    #signalEmitter: DBusSignalEmitter

    protected readonly opts: DBusInterfaceOpts

    protected readonly dbus: DBus

    protected readonly service: DBusService

    protected readonly object: DBusObject

    protected readonly introspectInterface: IntrospectInterface

    /**
     * The interface name, e.g. 'org.freedesktop.DBus.Properties'.
     */
    public readonly name: string

    /**
     * Created by DBus.getInterface and DBusObject.getInterface; not meant to be constructed directly.
     *
     * @param opts - The connection, service, object, interface name and introspection data.
     */
    constructor(opts: DBusInterfaceOpts) {
        this.opts = opts
        this.name = this.opts.iface
        this.dbus = this.opts.dbus
        this.service = this.opts.dbusService
        this.object = this.opts.dbusObject
        this.introspectInterface = this.opts.introspectInterface
    }

    /**
     * Converts a parameter object to an array of arguments based on introspection data.
     * Extracts input parameters from the provided parameter object, mapping them to the expected order of arguments
     * for a given method as defined in the introspection metadata. If a required parameter is missing, an error is thrown.
     * @param methodInfo - The introspection metadata of the method, containing argument definitions.
     * @param inputParameterObject - The parameter object containing named arguments to be mapped.
     * @returns An array of arguments extracted from the parameter object, ordered according to the method's signature.
     * @throws {NotEnoughParamsError} If a required parameter is missing from the input object.
     */
    protected objectifiedParameterToArguments(methodInfo: IntrospectMethod, inputParameterObject: Record<string, any>): any[] {
        const inputParameters: IntrospectMethodArgument[] = methodInfo.arg
            .filter((arg: IntrospectMethodArgument): boolean => arg.direction === 'in')
            .map((arg: IntrospectMethodArgument, index: number): IntrospectMethodArgument => ({
                ...arg,
                name: arg.name ? arg.name : `param${index}`
            }))
        const args: any[] = []
        for (const inputParameter of inputParameters) {
            const name: string = inputParameter.name!
            const arg: any = inputParameterObject[name]
            if (arg === undefined) throw new NotEnoughParamsError(`Parameter "${name}" is required`)
            args.push(arg)
        }
        return args
    }

    /**
     * The interface's methods by name, taking the input arguments in order as plain values (their types come from
     * the introspected signature) and waiting for the reply.
     *
     * A call resolves with undefined when the method returns nothing, the value itself when it returns one, and an
     * array when it returns several. It rejects with the error the service replied with, whose `name` is the DBus
     * error name (e.g. 'org.freedesktop.DBus.Error.InvalidArgs'), or with a TimeoutError after the connection's
     * callTimeout.
     *
     * @example
     * const id = await iface.method.GetId()
     * const [count, since] = await iface.method.Stats()
     */
    public get method(): Record<string, MethodCall> {
        const methods: Record<string, MethodCall> = {}
        this.listMethods().forEach((methodInfo: IntrospectMethod): void => {
            methods[methodInfo.name] = async (...args: any[]): Promise<any> => {
                const types: string[] = methodInfo.arg
                    .filter((arg: IntrospectMethodArgument): boolean => arg.direction === 'in')
                    .map((arg: IntrospectMethodArgument): string => arg.type)
                const signature: string | undefined = types.length ? types.join('') : undefined
                const inputArguments: any[] = signature ? args.length ? DBusSignedValue.parse(signature, args.length > 1 ? args : args[0]) : [] : []
                const result: any[] = await this.dbus.invoke({
                    service: this.service.name,
                    objectPath: this.object.name,
                    interface: this.name,
                    method: methodInfo.name,
                    signature: signature,
                    args: inputArguments,
                    decode: this.opts.decode
                })
                if (result.length > 1) return result
                return result[0]
            }
        })
        return methods
    }

    /**
     * Like `method`, but each method takes its input arguments as one object keyed by the introspected argument
     * names, so the order does not matter. Arguments without a name in the introspection data cannot be given.
     *
     * @example
     * await iface.namedMethod.Divide({dividend: 1, divisor: 4})
     * @throws {NotEnoughParamsError} (from the call) When an input argument is missing from the object.
     */
    public get namedMethod(): Record<string, NamedMethodCall> {
        const methods: Record<string, MethodCall> = {}
        this.listMethods().forEach((methodInfo: IntrospectMethod): void => {
            methods[methodInfo.name] = async (parameterObject?: Record<string, any>): Promise<any> => {
                const args: any[] = this.objectifiedParameterToArguments(methodInfo, parameterObject ? parameterObject : {})
                return await this.method[methodInfo.name](...args)
            }
        })
        return methods
    }

    /**
     * Like `method`, but each call is sent with NO_REPLY_EXPECTED and returns immediately; its result or error is
     * never seen. For methods whose outcome does not matter, e.g. notifications.
     */
    public get noReplyMethod(): Record<string, NoReplyMethodCall> {
        const noReplyMethods: Record<string, NoReplyMethodCall> = {}
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
                    args: args,
                    noReply: true
                })
            }
        })
        return noReplyMethods
    }

    /**
     * The no-reply form of `namedMethod`: arguments by name, nothing waited for.
     */
    public get namedNoReplyMethod(): Record<string, NamedNoReplyMethodCall> {
        const noReplyMethods: Record<string, NamedNoReplyMethodCall> = {}
        this.listMethods().forEach((methodInfo: IntrospectMethod): void => {
            noReplyMethods[methodInfo.name] = (parameterObject?: Record<string, any>): void => {
                const args: any[] = this.objectifiedParameterToArguments(methodInfo, parameterObject ? parameterObject : {})
                return this.noReplyMethod[methodInfo.name](...args)
            }
        })
        return noReplyMethods
    }

    /**
     * The interface's properties by name, each with `get()` and `set(value)`, which call
     * org.freedesktop.DBus.Properties.Get and Set. The value's type comes from the introspected signature.
     *
     * @example
     * const volume = await iface.property.Volume.get()
     * await iface.property.Volume.set(50)
     * @throws {AccessPropertyForbiddenError} (from get/set) When the introspected access mode does not allow it.
     */
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
                        property: propertyInfo.name,
                        decode: this.opts.decode
                    })
                }
            }
        })
        return properties
    }

    /**
     * Receives this interface's signals from this object: listen with the signal name as the event, and the listener
     * gets the signal's arguments. Listening adds a match rule on the bus; removing the last listener removes it.
     * The emitter follows the service to its new owner when it restarts.
     *
     * @example
     * iface.signal.on('PropertiesChanged', (iface, changed, invalidated) => console.log(changed))
     * iface.signal.on('*', (signalName, ...args) => console.log(signalName, args))   // every signal
     */
    public get signal(): DBusSignalEmitter {
        if (!this.#signalEmitter) this.#signalEmitter = this.dbus.createSignalEmitter({
            service: this.service.name,
            uniqueName: this.service.uniqueName,
            objectPath: this.object.name,
            interface: this.name,
            decode: this.opts.decode
        })
        return this.#signalEmitter
    }

    /**
     * The interface's methods as introspected: names, arguments with types and directions, annotations.
     */
    public listMethods(): IntrospectMethod[] {
        return this.introspectInterface.method
    }

    /**
     * The interface's properties as introspected: names, types, access modes, annotations.
     */
    public listProperties(): IntrospectProperty[] {
        return this.introspectInterface.property
    }

    /**
     * The interface's signals as introspected: names, arguments with types, annotations.
     */
    public listSignals(): IntrospectSignal[] {
        return this.introspectInterface.signal
    }
}
