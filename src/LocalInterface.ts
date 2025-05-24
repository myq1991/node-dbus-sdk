import {DBusPropertyAccess} from './lib/enums/DBusPropertyAccess'
import {DefineMethodArgumentOpts, DefineMethodOpts} from './types/DefineMethodOpts'
import {DefinePropertyOpts} from './types/DefinePropertyOpts'
import {DefineSignalOpts} from './types/DefineSignalOpts'
import {IntrospectMethod} from './types/IntrospectMethod'
import {IntrospectProperty} from './types/IntrospectProperty'
import {IntrospectSignal} from './types/IntrospectSignal'
import {IntrospectInterface} from './types/IntrospectInterface'
import EventEmitter from 'node:events'
import {
    LocalInterfaceInvalidMethodNameError,
    LocalInterfaceInvalidNameError,
    LocalInterfaceInvalidPropertyNameError,
    LocalInterfaceInvalidSignalNameError,
    LocalInterfaceMethodDefinedError,
    LocalInterfacePropertyDefinedError,
    LocalInterfaceSignalDefinedError
} from './lib/Errors'
import {DBus} from './DBus'
import {LocalObject} from './LocalObject'
import {IntrospectMethodArgument} from './types/IntrospectMethodArgument'
import {DBusSignedValue} from './lib/DBusSignedValue'
import {CreateDBusError} from './lib/CreateDBusError'
import {IntrospectSignalArgument} from './types/IntrospectSignalArgument'
import {Signature} from './lib/Signature'
import {DBusBufferEncoder} from './lib/DBusBufferEncoder'
import {DBusBufferDecoder} from './lib/DBusBufferDecoder'

export class LocalInterface {

    readonly #name: string

    #introspectMethods: IntrospectMethod[] = []

    #definedMethods: Record<string, {
        inputSignature?: string
        outputSignature?: string
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

    /**
     * Getter for the DBus instance associated with this interface's object.
     * @returns The DBus instance if the object is defined, otherwise undefined.
     */
    public get dbus(): DBus | undefined {
        if (!this.object) return
        return this.object.dbus
    }

    /**
     * Getter for the name of this interface.
     * @returns The interface name as a string.
     */
    public get name(): string {
        return this.#name
    }

    /**
     * Constructor for LocalInterface.
     * Initializes the interface with a validated name.
     * @param interfaceName - The name of the interface to be validated and set.
     */
    constructor(interfaceName: string) {
        this.#name = this.validateDBusInterfaceName(interfaceName)
    }

    /**
     * Validates a DBus interface name based on DBus naming rules.
     * @param interfaceName - The name to validate.
     * @returns The validated interface name if it passes all checks.
     * @throws LocalInterfaceInvalidNameError if the name does not meet DBus naming criteria.
     */
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

    /**
     * Validates a DBus method name based on DBus naming rules.
     * @param methodName - The name to validate.
     * @returns The validated method name if it passes all checks.
     * @throws LocalInterfaceInvalidMethodNameError if the name does not meet DBus naming criteria.
     */
    protected validateDBusMethodName(methodName: string | any): string {
        // Step 1: Check if the input is a string and not empty
        if (typeof methodName !== 'string' || methodName.length === 0) {
            throw new LocalInterfaceInvalidMethodNameError('Method name must be a non-empty string.')
        }

        // Step 2: Check length limit (maximum 255 bytes, consistent with other DBus name limits)
        if (methodName.length > 255) {
            throw new LocalInterfaceInvalidMethodNameError('Method name exceeds 255 bytes.')
        }

        // Step 3: Check if it starts with a digit
        if (methodName.match(/^[0-9]/)) {
            throw new LocalInterfaceInvalidMethodNameError('Method name cannot start with a digit.')
        }

        // Step 4: Check if it contains only allowed characters (letters, digits, underscore)
        for (let i = 0; i < methodName.length; i++) {
            const char = methodName[i]
            if (!/[a-zA-Z0-9_]/.test(char)) {
                throw new LocalInterfaceInvalidMethodNameError(`Method name contains invalid character "${char}".`)
            }
        }

        // All checks passed, return the method name
        return methodName
    }

    /**
     * Validates a DBus property name based on DBus naming rules.
     * @param propertyName - The name to validate.
     * @returns The validated property name if it passes all checks.
     * @throws LocalInterfaceInvalidPropertyNameError if the name does not meet DBus naming criteria.
     */
    protected validateDBusPropertyName(propertyName: string | any): string {
        // Step 1: Check if the input is a string and not empty
        if (typeof propertyName !== 'string' || propertyName.length === 0) {
            throw new LocalInterfaceInvalidPropertyNameError('Property name must be a non-empty string.')
        }

        // Step 2: Check length limit (maximum 255 bytes, consistent with other DBus name limits)
        if (propertyName.length > 255) {
            throw new LocalInterfaceInvalidPropertyNameError('Property name exceeds 255 bytes.')
        }

        // Step 3: Check if it starts with a digit
        if (propertyName.match(/^[0-9]/)) {
            throw new LocalInterfaceInvalidPropertyNameError('Property name cannot start with a digit.')
        }

        // Step 4: Check if it contains only allowed characters (letters, digits, underscore)
        for (let i = 0; i < propertyName.length; i++) {
            const char = propertyName[i]
            if (!/[a-zA-Z0-9_]/.test(char)) {
                throw new LocalInterfaceInvalidPropertyNameError(`Property name contains invalid character "${char}".`)
            }
        }

        // All checks passed, return the property name
        return propertyName
    }

    /**
     * Validates a DBus signal name based on DBus naming rules.
     * @param signalName - The name to validate.
     * @returns The validated signal name if it passes all checks.
     * @throws LocalInterfaceInvalidSignalNameError if the name does not meet DBus naming criteria.
     */
    protected validateDBusSignalName(signalName: string | any): string {
        // Step 1: Check if the input is a string and not empty
        if (typeof signalName !== 'string' || signalName.length === 0) {
            throw new LocalInterfaceInvalidSignalNameError('Signal name must be a non-empty string.')
        }

        // Step 2: Check length limit (maximum 255 bytes, consistent with other DBus name limits)
        if (signalName.length > 255) {
            throw new LocalInterfaceInvalidSignalNameError('Signal name exceeds 255 bytes.')
        }

        // Step 3: Check if it starts with a digit
        if (signalName.match(/^[0-9]/)) {
            throw new LocalInterfaceInvalidSignalNameError('Signal name cannot start with a digit.')
        }

        // Step 4: Check if it contains only allowed characters (letters, digits, underscore)
        for (let i = 0; i < signalName.length; i++) {
            const char = signalName[i]
            if (!/[a-zA-Z0-9_]/.test(char)) {
                throw new LocalInterfaceInvalidSignalNameError(`Signal name contains invalid character "${char}".`)
            }
        }

        // All checks passed, return the signal name
        return signalName
    }

    /**
     * Sets the LocalObject associated with this interface.
     * @param localObject - The LocalObject to associate with this interface, or undefined to clear the association.
     * @returns The instance of this LocalInterface for method chaining.
     */
    public setObject(localObject: LocalObject | undefined): this {
        this.object = localObject
        return this
    }

    /**
     * Getter for the introspection data of this interface.
     * @returns An IntrospectInterface object containing the name, methods, properties, and signals defined for this interface.
     */
    public get introspectInterface(): IntrospectInterface {
        return {
            name: this.#name,
            method: this.#introspectMethods,
            property: this.#introspectProperties,
            signal: this.#introspectSignals
        }
    }

    /**
     * Defines a new method for this interface.
     * @param opts - Options for defining the method, including name, input/output arguments, and the method implementation.
     * @returns The instance of this LocalInterface for method chaining.
     * @throws LocalInterfaceMethodDefinedError if the method is already defined.
     */
    public defineMethod(opts: DefineMethodOpts): this {
        if (this.#definedMethods[opts.name]) throw new LocalInterfaceMethodDefinedError(`Method ${opts.name} is already defined`)
        opts.name = this.validateDBusMethodName(opts.name)
        this.#definedMethods[opts.name] = {
            inputSignature: opts.inputArgs ? opts.inputArgs.map((inputArg: DefineMethodArgumentOpts): string => inputArg.type).join('') : undefined,
            outputSignature: opts.outputArgs ? opts.outputArgs.map((outputArg: DefineMethodArgumentOpts): string => outputArg.type).join('') : undefined,
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

    /**
     * Removes a defined method from this interface.
     * @param name - The name of the method to remove.
     * @returns The instance of this LocalInterface for method chaining.
     */
    public removeMethod(name: string): this {
        delete this.#definedMethods[name]
        this.#introspectMethods = this.#introspectMethods.filter((introspectMethod: IntrospectMethod): boolean => introspectMethod.name !== name)
        return this
    }

    /**
     * Defines a new property for this interface.
     * @param opts - Options for defining the property, including name, type, access mode, and getter/setter functions.
     * @returns The instance of this LocalInterface for method chaining.
     * @throws LocalInterfacePropertyDefinedError if the property is already defined.
     */
    public defineProperty(opts: DefinePropertyOpts): this {
        if (!opts.setter && !opts.getter) return this
        if (this.#definedProperties[opts.name]) throw new LocalInterfacePropertyDefinedError(`Property ${opts.name} is already defined`)
        let access: DBusPropertyAccess = DBusPropertyAccess.READWRITE
        if (opts.getter) access = DBusPropertyAccess.READ
        if (opts.setter) access = DBusPropertyAccess.WRITE
        if (opts.getter && opts.setter) access = DBusPropertyAccess.READWRITE
        opts.name = this.validateDBusPropertyName(opts.name)
        const getter: (() => Promise<any> | any) | undefined = opts.getter
        let setter: ((value: any) => Promise<void> | void) | undefined = undefined
        if (opts.emitPropertiesChanged && opts.setter) {
            if ((typeof opts.emitPropertiesChanged === 'boolean' && opts.emitPropertiesChanged) || opts.emitPropertiesChanged.emitValue) {
                setter = async (value: any): Promise<void> => {
                    await opts.setter!(value)
                    const changedProperties: Record<string, any> = {}
                    changedProperties[opts.name] = value
                    this.object?.propertiesInterface.emitPropertiesChanged(this.#name, changedProperties, [])
                }
            } else {
                setter = async (value: any): Promise<void> => {
                    await opts.setter!(value)
                    this.object?.propertiesInterface.emitPropertiesChanged(this.#name, {}, [opts.name])
                }
            }
        }
        this.#definedProperties[opts.name] = {
            signature: opts.type,
            getter: getter,
            setter: setter
        }
        this.#introspectProperties.push({
            name: opts.name,
            type: opts.type,
            access: access
        })
        return this
    }

    /**
     * Removes a defined property from this interface.
     * @param name - The name of the property to remove.
     * @returns The instance of this LocalInterface for method chaining.
     */
    public removeProperty(name: string): this {
        delete this.#definedProperties[name]
        this.#introspectProperties = this.#introspectProperties.filter((introspectProperty: IntrospectProperty): boolean => introspectProperty.name !== name)
        return this
    }

    /**
     * Defines a new signal for this interface.
     * @param opts - Options for defining the signal, including name, arguments, and associated event emitter.
     * @returns The instance of this LocalInterface for method chaining.
     * @throws LocalInterfaceSignalDefinedError if the signal is already defined.
     */
    public defineSignal(opts: DefineSignalOpts): this {
        if (this.#definedSignals[opts.name]) throw new LocalInterfaceSignalDefinedError(`Signal ${opts.name} is already defined`)
        const signature: string | undefined = opts.args?.map((arg: IntrospectSignalArgument): string => arg.type).join('')
        opts.name = this.validateDBusSignalName(opts.name)
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

    /**
     * Removes a defined signal from this interface.
     * @param name - The name of the signal to remove.
     * @returns The instance of this LocalInterface for method chaining.
     */
    public removeSignal(name: string): this {
        if (this.#definedSignals[name]) this.#definedSignals[name].eventEmitter.removeListener(name, this.#definedSignals[name].listener)
        delete this.#definedSignals[name]
        this.#introspectSignals = this.#introspectSignals.filter((introspectSignal: IntrospectSignal): boolean => introspectSignal.name !== name)
        return this
    }

    /**
     * Calls a defined method on this interface.
     * @param name - The name of the method to call.
     * @param payloadSignature - The signature of the input arguments.
     * @param args - The arguments to pass to the method.
     * @returns A Promise resolving to an object with the method's output signature and result.
     * @throws DBus error if the method is not found or if the input signature does not match.
     */
    public async callMethod(name: string, payloadSignature: string | undefined, ...args: any[]): Promise<{
        signature?: string
        result: any
    }> {
        if (!this.#definedMethods[name]) throw CreateDBusError('org.freedesktop.DBus.Error.UnknownMethod', `Method ${name} not found`)
        const methodInfo = this.#definedMethods[name]
        if (!Signature.areSignaturesCompatible(methodInfo.inputSignature, payloadSignature)) throw CreateDBusError('org.freedesktop.DBus.Error.InvalidArgs', `The input parameter signature '${payloadSignature}' does not match the expected method signature '${methodInfo.inputSignature}'.`)
        const result: any = await methodInfo.method(...args)
        return {
            signature: methodInfo.outputSignature ? methodInfo.outputSignature : undefined,
            result: result
        }
    }

    /**
     * Sets the value of a defined property on this interface.
     * @param name - The name of the property to set.
     * @param value - The value to set for the property.
     * @returns A Promise that resolves when the property is set.
     * @throws DBus error if the property is not found, the value signature does not match, or the property is read-only.
     */
    public async setProperty(name: string, value: any): Promise<void> {
        if (!this.#definedProperties[name]) throw CreateDBusError('org.freedesktop.DBus.Error.UnknownProperty', `Property ${name} not found`)
        try {
            const encoder: DBusBufferEncoder = new DBusBufferEncoder()
            const decoder: DBusBufferDecoder = new DBusBufferDecoder(encoder.endianness, encoder.encode(this.#definedProperties[name].signature, value))
            ;[value] = decoder.decode(this.#definedProperties[name].signature)
        } catch (e) {
            throw CreateDBusError('org.freedesktop.DBus.Error.InvalidArgs', `The property signature '${this.#definedProperties[name].signature}' does not match its value.`)
        }
        if (this.#definedProperties[name].setter) return this.#definedProperties[name].setter(value)
        throw CreateDBusError('org.freedesktop.DBus.Error.PropertyReadOnly', `Property ${name} is read only`)
    }

    /**
     * Gets the value of a defined property on this interface.
     * @param name - The name of the property to get.
     * @returns A Promise resolving to the property value.
     * @throws DBus error if the property is not found or is write-only.
     */
    public async getProperty(name: string): Promise<any> {
        if (!this.#definedProperties[name]) throw CreateDBusError('org.freedesktop.DBus.Error.UnknownProperty', `Property ${name} not found`)
        if (this.#definedProperties[name].getter) {
            const value: any = await this.#definedProperties[name].getter()
            return value === undefined ? value : new DBusSignedValue(this.#definedProperties[name].signature, this.#definedProperties[name].getter())
        }
        throw CreateDBusError('org.freedesktop.DBus.Error.PropertyWriteOnly', `Property ${name} is write only`)
    }

    /**
     * Lists the names of all defined methods on this interface.
     * @returns An array of method names as strings.
     */
    public methodNames(): string[] {
        return Object.keys(this.#definedMethods)
    }

    /**
     * Lists the names of all defined properties on this interface.
     * @returns An array of property names as strings.
     */
    public propertyNames(): string[] {
        return Object.keys(this.#definedProperties)
    }

    /**
     * Lists the names of all defined signals on this interface.
     * @returns An array of signal names as strings.
     */
    public signalNames(): string[] {
        return Object.keys(this.#definedSignals)
    }

}
