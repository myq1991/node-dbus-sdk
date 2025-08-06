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
import {DBusPropertyAccess} from './lib/enums/DBusPropertyAccess'
import {AccessPropertyForbiddenError, NotEnoughParamsError} from './lib/Errors'
import {DBusSignalEmitter} from './lib/DBusSignalEmitter'
import {DBusSignedValue} from './lib/DBusSignedValue'
import {ReplyModeParameterObjectMethodCall} from './types/ReplyModeParameterObjectMethodCall'
import {NoReplyModeParameterObjectMethodCall} from './types/NoReplyModeParameterObjectMethodCall'

export class DBusInterface {

    #signalEmitter: DBusSignalEmitter

    protected readonly opts: DBusInterfaceOpts

    protected readonly dbus: DBus

    protected readonly service: DBusService

    protected readonly object: DBusObject

    protected readonly introspectInterface: IntrospectInterface

    public readonly name: string

    /**
     * Constructor for DBusInterface.
     * Initializes the DBus interface with the provided options and sets up references to the DBus connection,
     * service, object, and introspection data.
     * @param opts - Configuration options for the DBus interface.
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
     * Getter for methods with reply mode.
     * Dynamically creates an object containing methods that expect a reply from the DBus invocation.
     * Each method handles input arguments with type signatures and returns the result of the invocation.
     * @returns A record of method names mapped to their callable implementations with reply mode.
     */
    public get method(): Record<string, ReplyModeMethodCall> {
        const methods: Record<string, ReplyModeMethodCall> = {}
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
                    args: inputArguments
                })
                if (result.length > 1) return result
                return result[0]
            }
        })
        return methods
    }

    /**
     * Getter for methods with reply mode using parameter object pattern.
     * Dynamically creates an object containing methods that expect a reply from the DBus invocation.
     * Each method accepts a single parameter object containing named arguments, which are mapped to the expected input parameters
     * based on the introspection data. This approach enhances readability and avoids errors due to parameter order.
     * @returns A record of method names mapped to their callable implementations with reply mode, accepting a parameter object.
     */
    public get parameterObjectifyMethod(): Record<string, ReplyModeParameterObjectMethodCall> {
        const methods: Record<string, ReplyModeMethodCall> = {}
        this.listMethods().forEach((methodInfo: IntrospectMethod): void => {
            methods[methodInfo.name] = async (parameterObject?: Record<string, any>): Promise<any> => {
                const args: any[] = this.objectifiedParameterToArguments(methodInfo, parameterObject ? parameterObject : {})
                return await this.method[methodInfo.name](...args)
            }
        })
        return methods
    }

    /**
     * Getter for methods with no-reply mode.
     * Dynamically creates an object containing methods that do not expect a reply from the DBus invocation.
     * These methods are used for fire-and-forget calls.
     * @returns A record of method names mapped to their callable implementations with no-reply mode.
     */
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

    /**
     * Getter for methods with no-reply mode using parameter object pattern.
     * Dynamically creates an object containing methods that do not expect a reply from the DBus invocation.
     * Each method accepts a single parameter object containing named arguments, which are mapped to the expected input parameters
     * based on the introspection data. This approach enhances readability and avoids errors due to parameter order.
     * These methods are used for fire-and-forget calls.
     * @returns A record of method names mapped to their callable implementations with no-reply mode, accepting a parameter object.
     */
    public get parameterObjectifyNoReplyMethod(): Record<string, NoReplyModeParameterObjectMethodCall> {
        const noReplyMethods: Record<string, NoReplyModeParameterObjectMethodCall> = {}
        this.listMethods().forEach((methodInfo: IntrospectMethod): void => {
            noReplyMethods[methodInfo.name] = (parameterObject?: Record<string, any>): void => {
                const args: any[] = this.objectifiedParameterToArguments(methodInfo, parameterObject ? parameterObject : {})
                return this.noReplyMethod[methodInfo.name](...args)
            }
        })
        return noReplyMethods
    }

    /**
     * Getter for properties of the DBus interface.
     * Dynamically creates an object containing property operations (get/set) for each property defined in the introspection data.
     * Access control is enforced based on property access mode (read/write/readwrite).
     * @returns A record of property names mapped to their get/set operations.
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
                        property: propertyInfo.name
                    })
                }
            }
        })
        return properties
    }

    /**
     * Getter for the DBus signal emitter.
     * Lazily initializes and returns a signal emitter for emitting signals associated with this interface.
     * @returns A DBusSignalEmitter instance for handling signal emissions.
     */
    public get signal(): DBusSignalEmitter {
        if (!this.#signalEmitter) this.#signalEmitter = this.dbus.createSignalEmitter({
            service: this.service.name,
            uniqueName: this.service.uniqueName,
            objectPath: this.object.name,
            interface: this.name
        })
        return this.#signalEmitter
    }

    /**
     * Lists all methods defined in the introspection data for this interface.
     * @returns An array of IntrospectMethod objects representing the methods of this interface.
     */
    public listMethods(): IntrospectMethod[] {
        return this.introspectInterface.method
    }

    /**
     * Lists all properties defined in the introspection data for this interface.
     * @returns An array of IntrospectProperty objects representing the properties of this interface.
     */
    public listProperties(): IntrospectProperty[] {
        return this.introspectInterface.property
    }

    /**
     * Lists all signals defined in the introspection data for this interface.
     * @returns An array of IntrospectSignal objects representing the signals of this interface.
     */
    public listSignals(): IntrospectSignal[] {
        return this.introspectInterface.signal
    }
}
