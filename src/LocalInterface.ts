import {DBusPropertyAccess} from './lib/DBusPropertyAccess'
import {DefineMethodArgumentOpts, DefineMethodOpts} from './types/DefineMethodOpts'
import {DefinePropertyOpts} from './types/DefinePropertyOpts'
import {DefineSignalOpts} from './types/DefineSignalOpts'
import {IntrospectMethod} from './types/IntrospectMethod'
import {IntrospectProperty} from './types/IntrospectProperty'
import {IntrospectSignal} from './types/IntrospectSignal'
import {IntrospectInterface} from './types/IntrospectInterface'
import EventEmitter from 'node:events'
import {
    LocalInterfaceMethodDefinedError, LocalInterfaceMethodNotFoundError,
    LocalInterfacePropertyDefinedError, LocalInterfacePropertyNotFoundError,
    LocalInterfaceSignalDefinedError
} from './lib/Errors'
import {DBus} from './DBus'
import {LocalObject} from './LocalObject'
import {IntrospectMethodArgument} from './types/IntrospectMethodArgument'
import {DBusSignedValue} from './lib/DBusSignedValue'

export class LocalInterface {

    readonly #name: string

    #introspectMethods: IntrospectMethod[] = []

    #definedMethods: Record<string, {
        signature?: string
        method: (...args: any[]) => Promise<any | any[]> | any | any[]
    }> = {}

    #introspectProperties: IntrospectProperty[] = []

    #definedProperties: Record<string, {
        signature: string
        getter?: () => Promise<any> | any
        setter?: (value: any) => Promise<void> | void
    }> = {}

    #introspectSignals: IntrospectSignal[] = []

    #definedSignals: Record<string, {
        listener: (...args: any[]) => void,
        eventEmitter: EventEmitter
    }> = {}

    public object: LocalObject | undefined

    public get dbus(): DBus | undefined {
        if (!this.object) return
        return this.object.dbus
    }

    public get name(): string {
        return this.#name
    }

    constructor(interfaceName: string) {
        this.#name = interfaceName
    }

    public setObject(localObject: LocalObject | undefined): this {
        this.object = localObject
        return this
    }

    public get introspectInterface(): IntrospectInterface {
        return {
            name: this.#name,
            method: this.#introspectMethods,
            property: this.#introspectProperties,
            signal: this.#introspectSignals
        }
    }

    public defineMethod(opts: DefineMethodOpts): this {
        if (this.#definedMethods[opts.name]) throw new LocalInterfaceMethodDefinedError(`Method ${opts.name} is already defined`)
        this.#definedMethods[opts.name] = {
            signature: opts.outputArgs ? opts.outputArgs.map((outputArg: DefineMethodArgumentOpts): string => outputArg.type).join('') : undefined,
            method: opts.method
        }
        this.#introspectMethods.push({
            name: opts.name,
            arg: [
                ...(opts.inputArgs ? opts.inputArgs.map((inputArg: DefineMethodArgumentOpts): IntrospectMethodArgument => ({
                    name: inputArg.name,
                    type: inputArg.type,
                    direction: 'in'
                })) : []),
                ...(opts.outputArgs ? opts.outputArgs.map((outputArg: DefineMethodArgumentOpts): IntrospectMethodArgument => ({
                    name: outputArg.name,
                    type: outputArg.type,
                    direction: 'out'
                })) : [])]
        })
        return this
    }

    public removeMethod(name: string): this {
        delete this.#definedMethods[name]
        this.#introspectMethods = this.#introspectMethods.filter((introspectMethod: IntrospectMethod): boolean => introspectMethod.name !== name)
        return this
    }

    public defineProperty(opts: DefinePropertyOpts): this {
        if (!opts.setter && !opts.getter) return this
        if (this.#definedProperties[opts.name]) throw new LocalInterfacePropertyDefinedError(`Property ${opts.name} is already defined`)
        let access: DBusPropertyAccess = DBusPropertyAccess.READWRITE
        if (opts.getter) access = DBusPropertyAccess.READ
        if (opts.setter) access = DBusPropertyAccess.WRITE
        if (opts.getter && opts.setter) access = DBusPropertyAccess.READWRITE
        this.#definedProperties[opts.name] = {
            signature: opts.type,
            getter: opts.getter,
            setter: opts.setter
        }
        this.#introspectProperties.push({
            name: opts.name,
            type: opts.type,
            access: access
        })
        return this
    }

    public removeProperty(name: string): this {
        delete this.#definedProperties[name]
        this.#introspectProperties = this.#introspectProperties.filter((introspectProperty: IntrospectProperty): boolean => introspectProperty.name !== name)
        return this
    }

    public defineSignal(opts: DefineSignalOpts): this {
        if (this.#definedSignals[opts.name]) throw new LocalInterfaceSignalDefinedError(`Signal ${opts.name} is already defined`)
        const signature: string | undefined = opts.args?.map(arg => arg.type).join('')
        this.#definedSignals[opts.name] = {
            listener: (...args: any[]): void => {
                if (!this.dbus || !this.object) return
                this.dbus.emitSignal({
                    objectPath: this.object.name,
                    interface: this.#name,
                    signal: opts.name,
                    signature: signature,
                    data: args
                })
            },
            eventEmitter: opts.eventEmitter
        }
        this.#introspectSignals.push({
            name: opts.name,
            arg: opts.args ? opts.args : []
        })
        this.#definedSignals[opts.name].eventEmitter.on(opts.name, this.#definedSignals[opts.name].listener)
        return this
    }

    public removeSignal(name: string): this {
        if (this.#definedSignals[name]) this.#definedSignals[name].eventEmitter.removeListener(name, this.#definedSignals[name].listener)
        delete this.#definedSignals[name]
        this.#introspectSignals = this.#introspectSignals.filter((introspectSignal: IntrospectSignal): boolean => introspectSignal.name !== name)
        return this
    }

    public async callMethod(name: string, ...args: any[]): Promise<{
        signature?: string
        result: any
    }> {
        if (!this.#definedMethods[name]) throw new LocalInterfaceMethodNotFoundError(`Method ${name} not found`)
        const methodInfo = this.#definedMethods[name]
        const result: any = await methodInfo.method(...args)
        return {
            signature: methodInfo.signature ? methodInfo.signature : undefined,
            result: result
        }
    }

    public async setProperty(name: string, value: any): Promise<void> {
        if (!this.#definedProperties[name]) throw new LocalInterfacePropertyNotFoundError(`Property ${name} not found`)
        if (this.#definedProperties[name].setter) await this.#definedProperties[name].setter(value)
    }

    public async getProperty(name: string): Promise<any> {
        if (!this.#definedProperties[name]) throw new LocalInterfacePropertyNotFoundError(`Property ${name} not found`)
        if (this.#definedProperties[name].getter) {
            const value: any = await this.#definedProperties[name].getter()
            return value === undefined ? value : new DBusSignedValue(this.#definedProperties[name].signature, this.#definedProperties[name].getter())
        }
    }

    public methodNames(): string[] {
        return Object.keys(this.#definedMethods)
    }

    public propertyNames(): string[] {
        return Object.keys(this.#definedProperties)
    }

    public signalNames(): string[] {
        return Object.keys(this.#definedSignals)
    }

}