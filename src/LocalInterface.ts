import {DBusPropertyAccess} from './lib/enums/DBusPropertyAccess'
import {DefineMethodArgumentOpts, DefineMethodOpts} from './types/DefineMethodOpts'
import {DefinePropertyOpts, EmitPropertiesChangedOpts} from './types/DefinePropertyOpts'
import {MethodCallContext} from './types/MethodCallContext'
import {IntrospectAnnotation} from './types/IntrospectAnnotation'
import {DefineSignalArgumentOpts, DefineSignalOpts} from './types/DefineSignalOpts'
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
    LocalInterfaceSignalDefinedError,
    LocalInterfaceInvalidAnnotationError
} from './lib/Errors'
import {DBus} from './DBus'
import {LocalObject} from './LocalObject'
import {IntrospectMethodArgument} from './types/IntrospectMethodArgument'
import {DBusSignedValue} from './lib/DBusSignedValue'
import {createDBusError} from './lib/createDBusError'
import {IntrospectSignalArgument} from './types/IntrospectSignalArgument'
import {Signature} from './lib/Signature'
import {DBusBufferEncoder} from './lib/DBusBufferEncoder'
import {DBusBufferDecoder} from './lib/DBusBufferDecoder'
import {PropertiesInterface} from './lib/common/PropertiesInterface'

/**
 * An interface of a service you provide: its methods, properties and signals, defined with defineMethod,
 * defineProperty and defineSignal. Add it to a LocalObject, and the object to a LocalService.
 *
 * @example
 * const iface = new LocalInterface('org.example.Greeter1')
 *     .defineMethod({name: 'Greet', inputArgs: [{type: 's'}], outputArgs: [{type: 's'}], method: (name: string): string => `Hello, ${name}!`})
 *     .defineProperty({name: 'Greeting', type: 's', getter: (): string => 'Hello'})
 * const object = new LocalObject('/org/example/Greeter')
 * object.addInterface(iface)
 * const service = new LocalService('org.example.Greeter')
 * service.addObject(object)
 * await service.run()
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
        withContext: boolean
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
        setter?: (value: any) => Promise<void>
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

    #object: LocalObject | undefined

    /**
     * The LocalObject this interface was added to, if any.
     */
    public get object(): LocalObject | undefined {
        return this.#object
    }

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
     * @internal
     * Sets the LocalObject associated with this interface.
     * Links the interface to a specific object within a DBus service, providing context for operations
     * such as signal emission or property access on a specific object path.
     *
     * @param localObject - The LocalObject to associate with this interface, or undefined to clear the association.
     * @returns The instance of this LocalInterface for method chaining.
     */
    public setObject(localObject: LocalObject | undefined): this {
        this.#object = localObject
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
        const introspectInterface: IntrospectInterface = {
            name: this.#name,
            method: this.#introspectMethods,
            property: this.#introspectProperties,
            signal: this.#introspectSignals
        }
        if (this.#annotations.length) introspectInterface.annotation = [...this.#annotations]
        return introspectInterface
    }

    /**
     * Annotations of the interface itself.
     */
    #annotations: IntrospectAnnotation[] = []

    /**
     * Adds an annotation to the interface itself (methods, properties and signals take theirs in their options),
     * e.g. defineAnnotation('org.freedesktop.DBus.Deprecated', 'true'). Replaces an annotation with the same name.
     *
     * @param name - The annotation's name, in the form of an interface name.
     * @param value - The annotation's value.
     * @returns The instance of this LocalInterface for method chaining.
     * @throws {LocalInterfaceInvalidAnnotationError} If the name or value is invalid.
     */
    public defineAnnotation(name: string, value: string): this {
        const [annotation] = LocalInterface.toAnnotations({[name]: value})
        this.#annotations = this.#annotations.filter((existing: IntrospectAnnotation): boolean => existing.name !== annotation.name).concat(annotation)
        return this
    }

    /**
     * Removes an annotation of the interface itself.
     *
     * @param name - The annotation's name.
     * @returns The instance of this LocalInterface for method chaining.
     */
    public removeAnnotation(name: string): this {
        this.#annotations = this.#annotations.filter((existing: IntrospectAnnotation): boolean => existing.name !== name)
        return this
    }

    /**
     * Validates annotations given as name → value and converts them to introspection data.
     *
     * @throws {LocalInterfaceInvalidAnnotationError} If a name is not in the form of an interface name or a value is not a string.
     */
    protected static toAnnotations(annotations: Record<string, string>): IntrospectAnnotation[] {
        return Object.entries(annotations).map(([name, value]: [string, string]): IntrospectAnnotation => {
            if (name.length > 255 || !/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)+$/.test(name)) {
                throw new LocalInterfaceInvalidAnnotationError(`Invalid annotation name "${name}": it must have the form of an interface name, e.g. org.freedesktop.DBus.Deprecated`)
            }
            if (typeof value !== 'string') throw new LocalInterfaceInvalidAnnotationError(`The value of annotation ${name} must be a string, got ${typeof value}`)
            return {name, value}
        })
    }

    /**
     * Adds the given annotations, if any, to an introspection entry.
     */
    protected static annotated<T extends { annotation?: IntrospectAnnotation[] }>(entry: T, annotations?: Record<string, string>): T {
        const converted: IntrospectAnnotation[] = annotations ? LocalInterface.toAnnotations(annotations) : []
        if (converted.length) entry.annotation = converted
        return entry
    }

    /**
     * Defines a method. The handler receives the input arguments in order as plain values (see the README's type
     * mapping), plus the call's context last if `withContext` is set. It may be async. What it returns is sent back
     * typed by `outputArgs`: with one output argument, return its value (an array for 'as', an object for 'a{sv}');
     * with several, return an array holding one value per output argument; with none, the return value is ignored.
     * An error it throws is sent to the caller as a DBus error named after the error's `name` when that is a valid
     * DBus error name (use createDBusError), and '<service name>.<name>' or '<service name>.Error' otherwise.
     *
     * @example
     * iface.defineMethod({
     *     name: 'Divide',
     *     inputArgs: [{name: 'dividend', type: 'd'}, {name: 'divisor', type: 'd'}],
     *     outputArgs: [{name: 'quotient', type: 'd'}],
     *     method: (dividend: number, divisor: number): number => {
     *         if (divisor === 0) throw createDBusError('org.example.Error.DivisionByZero', 'Cannot divide by zero')
     *         return dividend / divisor
     *     }
     * })
     *
     * @param opts - Name, input and output arguments with their types, the handler, and optional withContext and
     *               annotations.
     * @returns This interface, for chaining.
     * @throws {LocalInterfaceMethodDefinedError} If a method with the same name is already defined.
     * @throws {LocalInterfaceInvalidMethodNameError} If the name is not a valid DBus member name.
     */
    public defineMethod(opts: DefineMethodOpts): this {
        if (this.#definedMethods[opts.name]) throw new LocalInterfaceMethodDefinedError(`Method ${opts.name} is already defined`)
        opts.name = this.validateDBusMethodName(opts.name)
        this.#definedMethods[opts.name] = {
            inputSignature: opts.inputArgs ? opts.inputArgs.map((inputArg: DefineMethodArgumentOpts): string => inputArg.type).join('') : undefined,
            outputSignature: opts.outputArgs ? opts.outputArgs.map((outputArg: DefineMethodArgumentOpts): string => outputArg.type).join('') : undefined,
            method: opts.method,
            withContext: !!opts.withContext
        }
        const argument = (arg: DefineMethodArgumentOpts, direction: string): IntrospectMethodArgument => LocalInterface.annotated<IntrospectMethodArgument>({
            name: arg.name,
            type: arg.type,
            direction: direction
        }, arg.annotations)
        this.#introspectMethods.push(LocalInterface.annotated<IntrospectMethod>({
            name: opts.name,
            arg: [
                ...(opts.inputArgs ? opts.inputArgs.map((inputArg: DefineMethodArgumentOpts): IntrospectMethodArgument => argument(inputArg, 'in')) : []),
                ...(opts.outputArgs ? opts.outputArgs.map((outputArg: DefineMethodArgumentOpts): IntrospectMethodArgument => argument(outputArg, 'out')) : [])]
        }, opts.annotations))
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
     * Defines a property. Its access follows the functions given: getter only → read, setter only → write, both →
     * readwrite. The getter returns a plain value of the property's type; the setter receives one and may be async
     * or throw, which the caller of Set sees as a DBus error.
     *
     * With emitPropertiesChanged, a change made through the setter (a DBus Set call, or setProperty from your own
     * code) sends org.freedesktop.DBus.Properties.PropertiesChanged, with the new value or, with
     * `{emitValue: false}`, as invalidated. A value changed some other way, e.g. a read-only property, is announced
     * with `object.propertiesInterface.emitPropertiesChanged(iface.name, {Name: iface.getPropertySignedValue('Name')})`.
     *
     * @example
     * let volume = 50
     * iface.defineProperty({
     *     name: 'Volume',
     *     type: 'u',
     *     emitPropertiesChanged: true,
     *     getter: (): number => volume,
     *     setter: (value: number): void => { volume = Math.min(value, 100) }
     * })
     *
     * @param opts - Name, type signature, getter and/or setter, emitPropertiesChanged and annotations.
     * @returns This interface, for chaining.
     * @throws {LocalInterfacePropertyDefinedError} If a property with the same name is already defined.
     * @throws {LocalInterfaceInvalidPropertyNameError} If the name is not a valid DBus member name.
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
        const userSetter: ((value: any) => unknown) | undefined = opts.setter
        const emitChanges: boolean | EmitPropertiesChangedOpts | undefined = opts.emitPropertiesChanged
        // true or {emitValue: true} sends the new value; {emitValue: false} only invalidates the property
        const emitValue: boolean = typeof emitChanges === 'boolean' ? emitChanges : !!emitChanges?.emitValue
        // The setter is registered whether or not changes are announced, and is awaited so that errors (thrown or
        // rejected) reach the caller and PropertiesChanged reports the value after the setter has completed
        const setter: ((value: any) => Promise<void>) | undefined = userSetter ? async (value: any): Promise<void> => {
            await userSetter(value)
            if (!emitChanges) return
            if (emitValue && getter) {
                this.#propertiesEmitValueChanges.push({[opts.name]: this.getPropertySignedValue(opts.name)})
            } else {
                // A write-only property has no value to send
                this.#propertiesNotEmitValueChanges.push(opts.name)
            }
            setImmediate((): void => this.#propertyChangeHandler())
        } : undefined
        this.#definedProperties[opts.name] = {
            signature: opts.type,
            getter: getter,
            setter: setter
        }
        this.#introspectProperties.push(LocalInterface.annotated<IntrospectProperty>({
            name: opts.name,
            type: opts.type,
            access: access
        }, opts.annotations))
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
     * Defines a signal, sent whenever the given EventEmitter emits an event of the signal's name: the event's
     * arguments become the signal's arguments, typed by `args`. Signals are sent only while the interface is on an
     * object of a running service.
     *
     * @example
     * const events = new EventEmitter()
     * iface.defineSignal({name: 'Greeted', args: [{name: 'name', type: 's'}, {name: 'count', type: 'u'}], eventEmitter: events})
     * events.emit('Greeted', 'Alice', 1)   // sends the signal
     *
     * @param opts - Name, arguments with their types, the EventEmitter, and annotations.
     * @returns This interface, for chaining.
     * @throws {LocalInterfaceSignalDefinedError} If a signal with the same name is already defined.
     * @throws {LocalInterfaceInvalidSignalNameError} If the name is not a valid DBus member name.
     */
    public defineSignal(opts: DefineSignalOpts): this {
        if (this.#definedSignals[opts.name]) throw new LocalInterfaceSignalDefinedError(`Signal ${opts.name} is already defined`)
        const signature: string | undefined = opts.args?.map((arg: DefineSignalArgumentOpts): string => arg.type).join('')
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
        this.#introspectSignals.push(LocalInterface.annotated<IntrospectSignal>({
            name: opts.name,
            arg: (opts.args || []).map((arg: DefineSignalArgumentOpts): IntrospectSignalArgument => LocalInterface.annotated<IntrospectSignalArgument>({name: arg.name, type: arg.type}, arg.annotations))
        }, opts.annotations))
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
     * @param payloadSignature - The signature of the arguments, checked against the method's input signature.
     * @param args - The arguments.
     * @param context - The call being answered, passed to methods defined with `withContext`; LocalService provides
     *                  it, and it is undefined when the method is called directly.
     * @returns A Promise resolving to an object containing the method's output signature (if defined) and result.
     * @throws {Error} Named 'org.freedesktop.DBus.Error.UnknownMethod' or '...InvalidArgs' when the method is not
     *         defined or the signature does not match; otherwise whatever the method throws.
     */
    public async callMethod(name: string, payloadSignature: string | undefined, args: any[] = [], context?: MethodCallContext): Promise<{
        signature?: string
        result: any
    }> {
        if (!this.#definedMethods[name]) throw createDBusError('org.freedesktop.DBus.Error.UnknownMethod', `Method ${name} not found`)
        const methodInfo = this.#definedMethods[name]
        if (!Signature.areCompatible(methodInfo.inputSignature, payloadSignature)) throw createDBusError('org.freedesktop.DBus.Error.InvalidArgs', `The input parameter signature '${payloadSignature}' does not match the expected method signature '${methodInfo.inputSignature}'.`)
        const result: any = methodInfo.withContext ? await methodInfo.method(...args, context) : await methodInfo.method(...args)
        return {
            signature: methodInfo.outputSignature ? methodInfo.outputSignature : undefined,
            result: result
        }
    }

    /**
     * Sets a property through its setter, as a DBus Set call does: the value is checked against the property's type,
     * the setter is awaited, and PropertiesChanged is sent if the property was defined with emitPropertiesChanged.
     * Service code can use it to change a writable property and announce the change.
     *
     * @param name - The property name.
     * @param value - The new value.
     * @returns Resolves when the setter has finished.
     * @throws {Error} Named 'org.freedesktop.DBus.Error.UnknownProperty', '...InvalidArgs' (the value does not fit the
     *         type) or '...PropertyReadOnly' (no setter); otherwise whatever the setter throws.
     */
    public async setProperty(name: string, value: any): Promise<void> {
        if (!this.#definedProperties[name]) throw createDBusError('org.freedesktop.DBus.Error.UnknownProperty', `Property ${name} not found`)
        try {
            // Encode and decode the value to ensure it matches the property's signature
            const encoder: DBusBufferEncoder = new DBusBufferEncoder()
            const decoder: DBusBufferDecoder = new DBusBufferDecoder(encoder.endianness, encoder.encode(this.#definedProperties[name].signature, value))
            ;[value] = decoder.decode(this.#definedProperties[name].signature, false)
        } catch (e) {
            throw createDBusError('org.freedesktop.DBus.Error.InvalidArgs', `The property signature '${this.#definedProperties[name].signature}' does not match its value.`)
        }
        const setter: ((value: any) => Promise<void>) | undefined = this.#definedProperties[name].setter
        if (!setter) throw createDBusError('org.freedesktop.DBus.Error.PropertyReadOnly', `Property ${name} is read only`)
        await setter(value)
    }

    /**
     * The value of a property, from its getter.
     *
     * @param name - The property name.
     * @returns What the getter returns.
     * @throws {Error} Named 'org.freedesktop.DBus.Error.UnknownProperty' or '...PropertyWriteOnly' (no getter).
     */
    public getProperty(name: string): any {
        if (!this.#definedProperties[name]) throw createDBusError('org.freedesktop.DBus.Error.UnknownProperty', `Property ${name} not found`)
        if (this.#definedProperties[name].getter) return this.#definedProperties[name].getter()
        throw createDBusError('org.freedesktop.DBus.Error.PropertyWriteOnly', `Property ${name} is write only`)
    }

    /**
     * Gets the value of a defined property as a DBusSignedValue on this interface.
     * Retrieves the property value using getProperty and parses it into a DBusSignedValue with the correct signature,
     * ensuring it is suitable for DBus operations like method replies or signal data.
     *
     * @param name - The name of the property to get.
     * @returns A DBusSignedValue instance representing the property value with its associated signature.
     * @throws {Error} Named 'org.freedesktop.DBus.Error.UnknownProperty' or '...PropertyWriteOnly'.
     */
    public getPropertySignedValue(name: string): DBusSignedValue {
        const propertyValue: any = this.getProperty(name)
        return DBusSignedValue.parse(this.#definedProperties[name].signature, propertyValue)[0]
    }

    /**
     * Gets all readable properties as a record of DBusSignedValue objects.
     * Iterates through the defined properties that have a getter and retrieves their current values
     * as DBusSignedValue instances; write-only properties are left out.
     *
     * @returns A record mapping property names to their corresponding DBusSignedValue instances.
     */
    public getManagedProperties(): Record<string, DBusSignedValue> {
        const record: Record<string, DBusSignedValue> = {}
        for (const propertyName of this.listPropertyNames()) {
            // Write-only properties have no value to report
            if (!this.#definedProperties[propertyName].getter) continue
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
    public listMethodNames(): string[] {
        return Object.keys(this.#definedMethods)
    }

    /**
     * Lists the names of all defined properties on this interface.
     * Provides a convenient way to inspect the available properties for introspection or debugging purposes.
     *
     * @returns An array of property names as strings.
     */
    public listPropertyNames(): string[] {
        return Object.keys(this.#definedProperties)
    }

    /**
     * Lists the names of all defined signals on this interface.
     * Provides a convenient way to inspect the available signals for introspection or debugging purposes.
     *
     * @returns An array of signal names as strings.
     */
    public listSignalNames(): string[] {
        return Object.keys(this.#definedSignals)
    }
}
