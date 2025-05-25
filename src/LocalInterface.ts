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

/**
 * A class representing a local DBus interface.
 * This class allows the definition of methods, properties, and signals for a local DBus service.
 * It handles validation of names, introspection data, and interaction with the DBus for method calls,
 * property access, and signal emission. It serves as a building block for implementing custom DBus interfaces.
 */
export class LocalInterface {

    /**
     * The name of the interface, adhering to DBus naming conventions.
     * This uniquely identifies the interface within a service (e.g., 'org.example.MyInterface').
     */
    readonly #name: string

    /**
     * An array of IntrospectMethod objects for introspection.
     * Stores metadata about defined methods for generating introspection XML.
     */
    #introspectMethods: IntrospectMethod[] = []

    /**
     * A record of defined methods on this interface.
     * Maps method names to their input/output signatures and implementation functions.
     */
    #definedMethods: Record<string, {
        inputSignature?: string
        outputSignature?: string
        method: (...args: any[]) => Promise<any | any[]> | any | any[]
    }> = {}

    /**
     * An array of IntrospectProperty objects for introspection.
     * Stores metadata about defined properties for generating introspection XML.
     */
    #introspectProperties: IntrospectProperty[] = []

    /**
     * A record of defined properties on this interface.
     * Maps property names to their signatures, getter, and setter functions.
     */
    #definedProperties: Record<string, {
        signature: string
        getter?: () => any
        setter?: (value: any) => void
    }> = {}

    /**
     * An array of IntrospectSignal objects for introspection.
     * Stores metadata about defined signals for generating introspection XML.
     */
    #introspectSignals: IntrospectSignal[] = []

    /**
     * A record of defined signals on this interface.
     * Maps signal names to their listener functions and associated EventEmitter instances.
     */
    #definedSignals: Record<string, {
        listener: (...args: any[]) => void,
        eventEmitter: EventEmitter
    }> = {}

    /**
     * The LocalObject instance associated with this interface, if any.
     * Links the interface to a specific object within a DBus service for context.
     */
    public object: LocalObject | undefined

    /**
     * Getter for the DBus instance associated with this interface's object.
     * Provides access to the DBus connection for emitting signals or other operations.
     *
     * @returns The DBus instance if the object is defined, otherwise undefined.
     */
    public get dbus(): DBus | undefined {
        if (!this.object) return
        return this.object.dbus
    }

    /**
     * Getter for the name of this interface.
     * Returns the validated interface name set during construction.
     *
     * @returns The interface name as a string (e.g., 'org.example.MyInterface').
     */
    public get name(): string {
        return this.#name
    }

    /**
     * Constructor for LocalInterface.
     * Initializes the interface with a validated name, ensuring it adheres to DBus naming rules.
     *
     * @param interfaceName - The name of the interface to be validated and set (e.g., 'org.example.MyInterface').
     * @throws {LocalInterfaceInvalidNameError} If the provided name does not meet DBus naming criteria.
     */
    constructor(interfaceName: string) {
        this.#name = this.validateDBusInterfaceName(interfaceName)
    }

    /**
     * Validates a DBus interface name based on DBus naming rules.
     * Ensures the name is a non-empty string, within length limits, contains at least two elements
     * separated by dots, does not start or end with a dot, avoids consecutive dots, and uses
     * only allowed characters (letters, digits, underscores) in each element.
     *
     * @param interfaceName - The name to validate.
     * @returns The validated interface name if it passes all checks.
     * @throws {LocalInterfaceInvalidNameError} If the name does not meet DBus naming criteria.
     */
    protected validateDBusInterfaceName(interfaceName: string | any): string {
        // Step 1: Check if the input is a string and not empty
        if (typeof interfaceName !== 'string' || interfaceName.length === 0) {
            throw new LocalInterfaceInvalidNameError('Interface name must be a non-empty string.')
        }

        // Step 2: Check length limit (maximum 255 bytes as per DBus spec)
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

        // Step 5: Validate each element for allowed characters and structure
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
     * Ensures the name is a non-empty string, within length limits, does not start with a digit,
     * and uses only allowed characters (letters, digits, underscores).
     *
     * @param methodName - The name to validate.
     * @returns The validated method name if it passes all checks.
     * @throws {LocalInterfaceInvalidMethodNameError} If the name does not meet DBus naming criteria.
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
     * Ensures the name is a non-empty string, within length limits, does not start with a digit,
     * and uses only allowed characters (letters, digits, underscores).
     *
     * @param propertyName - The name to validate.
     * @returns The validated property name if it passes all checks.
     * @throws {LocalInterfaceInvalidPropertyNameError} If the name does not meet DBus naming criteria.
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
     * Ensures the name is a non-empty string, within length limits, does not start with a digit,
     * and uses only allowed characters (letters, digits, underscores).
     *
     * @param signalName - The name to validate.
     * @returns The validated signal name if it passes all checks.
     * @throws {LocalInterfaceInvalidSignalNameError} If the name does not meet DBus naming criteria.
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
     * Links the interface to a specific object within a DBus service for context during operations.
     *
     * @param localObject - The LocalObject to associate with this interface, or undefined to clear the association.
     * @returns The instance of this LocalInterface for method chaining.
     */
    public setObject(localObject: LocalObject | undefined): this {
        this.object = localObject
        return this
    }

    /**
     * Getter for the introspection data of this interface.
     * Provides metadata about the interface's methods, properties, and signals for DBus introspection.
     *
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
     * Adds a method with specified input and output arguments and an implementation function.
     * Validates the method name and updates introspection data.
     *
     * @param opts - Options for defining the method, including name, input/output arguments, and the method implementation.
     * @returns The instance of this LocalInterface for method chaining.
     * @throws {LocalInterfaceMethodDefinedError} If the method is already defined.
     * @throws {LocalInterfaceInvalidMethodNameError} If the method name does not meet DBus naming criteria.
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
     * Deletes the method and its introspection data from the interface.
     *
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
     * Adds a property with a specified type, access mode (read, write, read-write), and optional
     * getter/setter functions. Supports emitting property change signals if configured.
     *
     * @param opts - Options for defining the property, including name, type, access mode, getter/setter functions, and change emission settings.
     * @returns The instance of this LocalInterface for method chaining.
     * @throws {LocalInterfacePropertyDefinedError} If the property is already defined.
     * @throws {LocalInterfaceInvalidPropertyNameError} If the property name does not meet DBus naming criteria.
     */
    public defineProperty(opts: DefinePropertyOpts): this {
        if (!opts.setter && !opts.getter) return this // Skip if neither getter nor setter is provided
        if (this.#definedProperties[opts.name]) throw new LocalInterfacePropertyDefinedError(`Property ${opts.name} is already defined`)
        let access: DBusPropertyAccess = DBusPropertyAccess.READWRITE
        if (opts.getter) access = DBusPropertyAccess.READ
        if (opts.setter) access = DBusPropertyAccess.WRITE
        if (opts.getter && opts.setter) access = DBusPropertyAccess.READWRITE
        opts.name = this.validateDBusPropertyName(opts.name)
        const getter: (() => any) | undefined = opts.getter
        let setter: ((value: any) => void) | undefined = undefined
        if (opts.emitPropertiesChanged && opts.setter) {
            if ((typeof opts.emitPropertiesChanged === 'boolean' && opts.emitPropertiesChanged) || opts.emitPropertiesChanged.emitValue) {
                // Emit property changed signal with the new value
                setter = (value: any): void => {
                    opts.setter!(value)
                    const changedProperties: Record<string, any> = {}
                    changedProperties[opts.name] = value
                    this.object?.propertiesInterface.emitPropertiesChanged(this.#name, changedProperties, [])
                }
            } else {
                // Emit property changed signal without the new value (invalidated only)
                setter = (value: any): void => {
                    opts.setter!(value)
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
     * Deletes the property and its introspection data from the interface.
     *
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
     * Adds a signal with specified arguments and associates it with an EventEmitter for emission.
     * When the signal is triggered, it is emitted over the DBus connection if available.
     *
     * @param opts - Options for defining the signal, including name, arguments, and associated event emitter.
     * @returns The instance of this LocalInterface for method chaining.
     * @throws {LocalInterfaceSignalDefinedError} If the signal is already defined.
     * @throws {LocalInterfaceInvalidSignalNameError} If the signal name does not meet DBus naming criteria.
     */
    public defineSignal(opts: DefineSignalOpts): this {
        if (this.#definedSignals[opts.name]) throw new LocalInterfaceSignalDefinedError(`Signal ${opts.name} is already defined`)
        const signature: string | undefined = opts.args?.map((arg: IntrospectSignalArgument): string => arg.type).join('')
        opts.name = this.validateDBusSignalName(opts.name)
        this.#definedSignals[opts.name] = {
            listener: (...args: any[]): void => {
                if (!this.dbus || !this.object) return // Skip if DBus or object context is not available
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
        // Register the listener with the event emitter to handle signal emissions
        this.#definedSignals[opts.name].eventEmitter.on(opts.name, this.#definedSignals[opts.name].listener)
        return this
    }

    /**
     * Removes a defined signal from this interface.
     * Deletes the signal, removes its listener from the event emitter, and updates introspection data.
     *
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
     * Executes the method implementation with provided arguments after validating the input signature.
     *
     * @param name - The name of the method to call.
     * @param payloadSignature - The signature of the input arguments provided (e.g., 'si' for string and integer).
     * @param args - The arguments to pass to the method.
     * @returns A Promise resolving to an object with the method's output signature and result.
     * @throws {DBusError} If the method is not found or if the input signature does not match the expected signature.
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
     * Validates the value against the property's signature before calling the setter function.
     *
     * @param name - The name of the property to set.
     * @param value - The value to set for the property.
     * @returns A Promise that resolves when the property is set.
     * @throws {DBusError} If the property is not found, the value signature does not match, or the property is read-only.
     */
    public setProperty(name: string, value: any): void {
        if (!this.#definedProperties[name]) throw CreateDBusError('org.freedesktop.DBus.Error.UnknownProperty', `Property ${name} not found`)
        try {
            // Encode and decode the value to ensure it matches the property's signature
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
     * Retrieves the current value by calling the getter function if available.
     *
     * @param name - The name of the property to get.
     * @returns A Promise resolving to the property value.
     * @throws {DBusError} If the property is not found or is write-only.
     */
    public getProperty(name: string): any {
        if (!this.#definedProperties[name]) throw CreateDBusError('org.freedesktop.DBus.Error.UnknownProperty', `Property ${name} not found`)
        if (this.#definedProperties[name].getter) {
            const value: any = this.#definedProperties[name].getter()
            return value === undefined ? value : new DBusSignedValue(this.#definedProperties[name].signature, this.#definedProperties[name].getter())
        }
        throw CreateDBusError('org.freedesktop.DBus.Error.PropertyWriteOnly', `Property ${name} is write only`)
    }

    /**
     * Gets the value of a defined property as a DBusSignedValue on this interface.
     * Wraps the property value in a DBusSignedValue with the correct signature for DBus operations.
     *
     * @param name - The name of the property to get.
     * @returns A Promise resolving to a DBusSignedValue instance representing the property value.
     * @throws {DBusError} If the property is not found or is write-only.
     */
    public getPropertySignedValue(name: string): DBusSignedValue {
        const propertyValue: any = this.getProperty(name)
        return DBusSignedValue.parse(this.#definedProperties[name].signature, propertyValue)[0]
    }

    /**
     * Gets all managed properties as a record of DBusSignedValue objects.
     * Retrieves the current values of all properties on this interface.
     *
     * @returns A Promise resolving to a record mapping property names to their DBusSignedValue instances.
     */
    public getManagedProperties(): Record<string, DBusSignedValue> {
        const record: Record<string, DBusSignedValue> = {}
        for (const propertyName of this.propertyNames()) {
            record[propertyName] = this.getPropertySignedValue(propertyName)
        }
        return record
    }

    /**
     * Lists the names of all defined methods on this interface.
     * Provides a convenient way to inspect available methods.
     *
     * @returns An array of method names as strings.
     */
    public methodNames(): string[] {
        return Object.keys(this.#definedMethods)
    }

    /**
     * Lists the names of all defined properties on this interface.
     * Provides a convenient way to inspect available properties.
     *
     * @returns An array of property names as strings.
     */
    public propertyNames(): string[] {
        return Object.keys(this.#definedProperties)
    }

    /**
     * Lists the names of all defined signals on this interface.
     * Provides a convenient way to inspect available signals.
     *
     * @returns An array of signal names as strings.
     */
    public signalNames(): string[] {
        return Object.keys(this.#definedSignals)
    }
}
