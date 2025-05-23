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
    LocalInterfaceInvalidNameError,
    LocalInterfaceMethodDefinedError,
    LocalInterfacePropertyDefinedError,
    LocalInterfaceSignalDefinedError
} from './lib/Errors'
import {DBus} from './DBus'
import {LocalObject} from './LocalObject'
import {IntrospectMethodArgument} from './types/IntrospectMethodArgument'
import {DBusSignedValue} from './lib/DBusSignedValue'
import {CreateDBusError} from './lib/CreateDBusError'

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
        this.#name = this.validateDBusInterfaceName(interfaceName)
    }

    protected validateDBusInterfaceName(interfaceName: string | any): string {
        // Step 1: Check if the input is a string and not empty
        if (typeof interfaceName !== 'string' || interfaceName.length === 0) {
            throw new LocalInterfaceInvalidNameError('Interface name must be a non-empty string.')
        }

        // Step 2: Check length limit (maximum 255 bytes)
        if (interfaceName.length > 255) {
            throw new LocalInterfaceInvalidNameError('Interface name exceeds 255 bytes.')
        }

        // Step 3: Check if it starts or ends with a dot, or contains consecutive dots
        if (interfaceName.startsWith('.')) {
            throw new LocalInterfaceInvalidNameError('Interface name cannot start with a dot.')
        }
        if (interfaceName.endsWith('.')) {
            throw new LocalInterfaceInvalidNameError('Interface name cannot end with a dot.')
        }
        if (interfaceName.includes('..')) {
            throw new LocalInterfaceInvalidNameError('Interface name cannot contain consecutive dots.')
        }

        // Step 4: Split the interface name into elements and check if there are at least 2 elements
        const elements = interfaceName.split('.')
        if (elements.length < 2) {
            throw new LocalInterfaceInvalidNameError('Interface name must have at least two elements separated by dots.')
        }

        // Step 5: Validate each element
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i]

            // Check if element is empty
            if (element.length === 0) {
                throw new LocalInterfaceInvalidNameError(`Element at position ${i + 1} is empty.`)
            }

            // Check if element starts with a digit
            if (element.match(/^[0-9]/)) {
                throw new LocalInterfaceInvalidNameError(`Element "${element}" at position ${i + 1} cannot start with a digit.`)
            }

            // Check if element contains only allowed characters (letters, digits, underscore)
            for (let j = 0; j < element.length; j++) {
                const char = element[j]
                if (!/[a-zA-Z0-9_]/.test(char)) {
                    throw new LocalInterfaceInvalidNameError(`Element "${element}" at position ${i + 1} contains invalid character "${char}".`)
                }
            }
        }

        // All checks passed, return the interface name
        return interfaceName
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
        if (!this.#definedMethods[name]) throw CreateDBusError('org.freedesktop.DBus.Error.UnknownMethod', `Method ${name} not found`)
        const methodInfo = this.#definedMethods[name]
        const result: any = await methodInfo.method(...args)
        return {
            signature: methodInfo.signature ? methodInfo.signature : undefined,
            result: result
        }
    }

    public async setProperty(name: string, value: any): Promise<void> {
        if (!this.#definedProperties[name]) throw CreateDBusError('org.freedesktop.DBus.Error.UnknownProperty', `Property ${name} not found`)
        if (this.#definedProperties[name].setter) return this.#definedProperties[name].setter(value)
        throw CreateDBusError('org.freedesktop.DBus.Error.PropertyReadOnly', `Property ${name} is read only`)
    }

    public async getProperty(name: string): Promise<any> {
        if (!this.#definedProperties[name]) throw CreateDBusError('org.freedesktop.DBus.Error.UnknownProperty', `Property ${name} not found`)
        if (this.#definedProperties[name].getter) {
            const value: any = await this.#definedProperties[name].getter()
            return value === undefined ? value : new DBusSignedValue(this.#definedProperties[name].signature, this.#definedProperties[name].getter())
        }
        throw CreateDBusError('org.freedesktop.DBus.Error.PropertyWriteOnly', `Property ${name} is write only`)
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