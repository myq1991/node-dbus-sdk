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
import {PropertiesInterface} from './lib/common/PropertiesInterface'

/**
 * A class representing a local DBus interface.
 * This class enables the definition of methods, properties, and signals for a local DBus service,
 * facilitating the creation of custom interfaces. It manages name validation, introspection data,
 * and interactions with DBus for handling method calls, property access, and signal emission.
 */
export class LocalInterface {

    /**
     * The name of the interface, adhering to DBus naming conventions.
     * This uniquely identifies the interface within a service (e.g., 'org.example.MyInterface').
     */
    readonly #name: string

    /**
     * An array of IntrospectMethod objects for introspection.
     * Stores metadata about defined methods for generating introspection XML as per DBus specification.
     */
    #introspectMethods: IntrospectMethod[] = []

    /**
     * A record of defined methods on this interface.
     * Maps method names to their input/output signatures and implementation functions for execution.
     */
    #definedMethods: Record<string, {
        inputSignature?: string
        outputSignature?: string
        method: (...args: any[]) => Promise<any | any[]> | any | any[]
    }> = {}

    /**
     * An array of IntrospectProperty objects for introspection.
     * Stores metadata about defined properties for generating introspection XML as per DBus specification.
     */
    #introspectProperties: IntrospectProperty[] = []

    /**
     * A record of defined properties on this interface.
     * Maps property names to their signatures, getter, and setter functions for access and modification.
     */
    #definedProperties: Record<string, {
        signature: string
        getter?: () => any
        setter?: (value: any) => void
    }> = {}

    /**
     * An array of IntrospectSignal objects for introspection.
     * Stores metadata about defined signals for generating introspection XML as per DBus specification.
     */
    #introspectSignals: IntrospectSignal[] = []

    /**
     * A record of defined signals on this interface.
     * Maps signal names to their listener functions and associated EventEmitter instances for emission.
     */
    #definedSignals: Record<string, {
        listener: (...args: any[]) => void,
        eventEmitter: EventEmitter
    }> = {}

    /**
     * An array of records for properties whose changes should emit values.
     * Stores temporary records of changed properties with their new values to be included in the 'PropertiesChanged' signal.
     */
    #propertiesEmitValueChanges: Record<string, DBusSignedValue>[] = []

    /**
     * An array of property names whose changes should not emit values.
     * Stores temporary names of properties that are invalidated (changed without including new values) in the 'PropertiesChanged' signal.
     */
    #propertiesNotEmitValueChanges: string[] = []

    /**
     * Handles property change notifications by emitting the 'PropertiesChanged' signal.
     * Combines accumulated property changes (with and without values) into a single signal emission
     * if there are changes to report and a PropertiesInterface is available on the associated object.
     * Resets the accumulated change records after emission.
     *
     * @private
     */
    #propertyChangeHandler(): void {
        if (!this.#propertiesEmitValueChanges.length && !this.#propertiesNotEmitValueChanges.length) return
        const propertiesInterface: PropertiesInterface | undefined = this.object?.propertiesInterface
        if (!propertiesInterface) return
        const changedProperties: Record<string, DBusSignedValue> = this.#propertiesEmitValueChanges.reduce((previousValue: Record<string, DBusSignedValue>, currentValue: Record<string, DBusSignedValue>): Record<string, DBusSignedValue> => ({
            ...previousValue,
            ...currentValue
        }), {})
        const changedPropertyNames: string[] = [...new Set(this.#propertiesNotEmitValueChanges)]
        this.#propertiesEmitValueChanges = []
        this.#propertiesNotEmitValueChanges = []
        propertiesInterface.emitPropertiesChanged(this.#name, changedProperties, changedPropertyNames)
    }

    /**
     * The LocalObject instance associated with this interface, if any.
     * Links the interface to a specific object within a DBus service for contextual operations.
     */
    public object: LocalObject | undefined

    /**
     * Getter for the DBus instance associated with this interface's object.
     * Provides access to the DBus connection for operations such as emitting signals or sending messages.
     *
     * @returns The DBus instance if the associated object is defined and connected, otherwise undefined.
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
     * Initializes the interface with a validated name, ensuring it adheres to DBus naming rules
     * as specified in the DBus protocol documentation.
     *
     * @param interfaceName - The name of the interface to be validated and set (e.g., 'org.example.MyInterface').
     * @throws {LocalInterfaceInvalidNameError} If the provided name does not meet DBus naming criteria.
     */
    constructor(interfaceName: string) {
        this.#name = this.validateDBusInterfaceName(interfaceName)
    }

    /**
     * Validates a DBus interface name based on DBus naming rules.
     * Ensures the name is a non-empty string, within length limits (255 bytes), contains at least two elements
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
     * Ensures the name is a non-empty string, within length limits (255 bytes), does not start with a digit,
     * and uses only allowed characters (letters, digits, underscores) as per DBus conventions.
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
     * Ensures the name is a non-empty string, within length limits (255 bytes), does not start with a digit,
     * and uses only allowed characters (letters, digits, underscores) as per DBus conventions.
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
     * Ensures the name is a non-empty string, within length limits (255 bytes), does not start with a digit,
     * and uses only allowed characters (letters, digits, underscores) as per DBus conventions.
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
     * Links the interface to a specific object within a DBus service, providing context for operations
     * such as signal emission or property access on a specific object path.
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
     * Provides metadata about the interface's methods, properties, and signals in a format suitable
     * for DBus introspection, allowing clients to discover the capabilities of this interface.
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
     * Configures a method with specified input and output arguments and an implementation function,
     * validates the method name against DBus naming rules, and updates introspection data for discovery.
     *
     * @param opts - Options for defining the method, including name, input/output arguments, and the method implementation.
     * @returns The instance of this LocalInterface for method chaining.
     * @throws {LocalInterfaceMethodDefinedError} If a method with the same name is already defined.
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
     * Deletes the method from the internal record and removes its associated introspection data.
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
     * Configures a property with a specified type, determines access mode (read, write, read-write) based on provided
     * getter/setter functions, and supports emitting property change signals if configured via options.
     * Updates introspection data for discovery and sets up asynchronous change notifications via setImmediate.
     *
     * @param opts - Options for defining the property, including name, type, access mode, getter/setter functions, and change emission settings.
     * @returns The instance of this LocalInterface for method chaining.
     * @throws {LocalInterfacePropertyDefinedError} If a property with the same name is already defined.
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
                    changedProperties[opts.name] = this.getPropertySignedValue(opts.name)
                    this.#propertiesEmitValueChanges.push(changedProperties)
                    setImmediate((): void => this.#propertyChangeHandler())
                }
            } else {
                // Emit property changed signal without the new value (invalidated only)
                setter = (value: any): void => {
                    opts.setter!(value)
                    this.#propertiesNotEmitValueChanges.push(opts.name)
                    setImmediate((): void => this.#propertyChangeHandler())
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
     * Deletes the property from the internal record and removes its associated introspection data.
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
     * Configures a signal with specified arguments and associates it with an EventEmitter for emission.
     * When the signal is triggered, it is sent over the DBus connection if the interface is associated
     * with an object and a DBus connection is available.
     *
     * @param opts - Options for defining the signal, including name, arguments, and associated event emitter.
     * @returns The instance of this LocalInterface for method chaining.
     * @throws {LocalInterfaceSignalDefinedError} If a signal with the same name is already defined.
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
     * Deletes the signal from the internal record, removes its listener from the associated event emitter,
     * and updates the introspection data by removing the signal's metadata.
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
     * Executes the method implementation with the provided arguments after validating the input signature
     * to ensure compatibility with the defined method signature.
     *
     * @param name - The name of the method to call.
     * @param payloadSignature - The signature of the input arguments provided (e.g., 'si' for string and integer).
     * @param args - The arguments to pass to the method.
     * @returns A Promise resolving to an object containing the method's output signature (if defined) and result.
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
     * Validates the value against the property's signature by encoding and decoding it to ensure type compatibility
     * before invoking the setter function to update the property.
     *
     * @param name - The name of the property to set.
     * @param value - The value to set for the property.
     * @returns void
     * @throws {DBusError} If the property is not found, the value signature does not match the expected type,
     *                     or the property is read-only (no setter defined).
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
     * Retrieves the current value by invoking the getter function if available, returning it as a raw value.
     *
     * @param name - The name of the property to get.
     * @returns The property value as returned by the getter function.
     * @throws {DBusError} If the property is not found or is write-only (no getter defined).
     */
    public getProperty(name: string): any {
        if (!this.#definedProperties[name]) throw CreateDBusError('org.freedesktop.DBus.Error.UnknownProperty', `Property ${name} not found`)
        if (this.#definedProperties[name].getter) return this.#definedProperties[name].getter()
        throw CreateDBusError('org.freedesktop.DBus.Error.PropertyWriteOnly', `Property ${name} is write only`)
    }

    /**
     * Gets the value of a defined property as a DBusSignedValue on this interface.
     * Retrieves the property value using getProperty and parses it into a DBusSignedValue with the correct signature,
     * ensuring it is suitable for DBus operations like method replies or signal data.
     *
     * @param name - The name of the property to get.
     * @returns A DBusSignedValue instance representing the property value with its associated signature.
     * @throws {DBusError} If the property is not found or is write-only (no getter defined).
     */
    public getPropertySignedValue(name: string): DBusSignedValue {
        const propertyValue: any = this.getProperty(name)
        return DBusSignedValue.parse(this.#definedProperties[name].signature, propertyValue)[0]
    }

    /**
     * Gets all managed properties as a record of DBusSignedValue objects.
     * Iterates through all defined property names on this interface and retrieves their current values
     * as DBusSignedValue instances, providing a comprehensive view of the interface's properties.
     *
     * @returns A record mapping property names to their corresponding DBusSignedValue instances.
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
     * Provides a convenient way to inspect the available methods for introspection or debugging purposes.
     *
     * @returns An array of method names as strings.
     */
    public methodNames(): string[] {
        return Object.keys(this.#definedMethods)
    }

    /**
     * Lists the names of all defined properties on this interface.
     * Provides a convenient way to inspect the available properties for introspection or debugging purposes.
     *
     * @returns An array of property names as strings.
     */
    public propertyNames(): string[] {
        return Object.keys(this.#definedProperties)
    }

    /**
     * Lists the names of all defined signals on this interface.
     * Provides a convenient way to inspect the available signals for introspection or debugging purposes.
     *
     * @returns An array of signal names as strings.
     */
    public signalNames(): string[] {
        return Object.keys(this.#definedSignals)
    }
}
