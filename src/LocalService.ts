import {LocalObject} from './LocalObject'
import {DBus} from './DBus'
import {DBusMessage} from './lib/DBusMessage'
import {LocalObjectPathExistsError, LocalServiceInvalidNameError} from './lib/Errors'
import {IntrospectableInterface} from './lib/common/IntrospectableInterface'
import {LocalInterface} from './LocalInterface'
import {DBusSignedValue} from './lib/DBusSignedValue'
import {createDBusError} from './lib/createDBusError'
import {LocalServiceOpts} from './types/LocalServiceOpts'
import {ObjectManagerInterface} from './lib/common/ObjectManagerInterface'
import {RunServiceOpts} from './types/RunServiceOpts'
import {StopServiceOpts} from './types/StopServiceOpts'
import {DBusMessageFlags} from './lib/enums/DBusMessageFlags'
import {RequestNameFlags} from './lib/enums/RequestNameFlags'
import {RequestNameResultCode} from './lib/enums/RequestNameResultCode'

/**
 * A service you provide on the bus under a well-known name: holds LocalObjects, connects with run(), answers method
 * calls by routing them to the right object, interface and method, and stops with stop().
 *
 * The root object '/' exists from the start and carries org.freedesktop.DBus.ObjectManager, which announces objects
 * added and removed while the service runs. Do not add another object at '/'.
 *
 * @example
 * const service = new LocalService('org.example.Greeter')
 * service.addObject(greeterObject)
 * const result = await service.run()   // the session bus; run({busAddress}) for another
 * if (result !== RequestNameResultCode.DBUS_REQUEST_NAME_REPLY_PRIMARY_OWNER) console.error('name is taken')
 * process.once('SIGTERM', () => service.stop({graceful: true, timeout: 5000}))
 */
export class LocalService {

    /**
     * A regular expression for validating DBus error names.
     * Ensures error names follow the DBus naming convention (e.g., 'org.example.ErrorName').
     */
    readonly #errorNameRegex: RegExp = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/

    /**
     * The name of this service, adhering to DBus naming conventions.
     * This uniquely identifies the service on the bus (e.g., 'org.example.Service').
     */
    readonly #name: string

    /**
     * A map of object paths to their corresponding LocalObject instances.
     * Stores all objects associated with this service for quick lookup and management.
     */
    readonly #objectMap: Map<string, LocalObject> = new Map()

    /**
     * A default IntrospectableInterface instance for handling introspection requests.
     * Used when a specific object or interface is not found but introspection is requested.
     */
    readonly #defaultIntrospectableInterface: IntrospectableInterface = new IntrospectableInterface()

    #dbus: DBus

    /**
     * The DBus connection of the running service (set by run).
     */
    public get dbus(): DBus {
        return this.#dbus
    }

    readonly #objectManagerPath: string | null

    /**
     * The service's object manager, at the path given by the objectManagerPath option ('/' by default); undefined
     * with objectManagerPath null.
     */
    public get objectManager(): ObjectManagerInterface | undefined {
        if (this.#objectManagerPath === null) return
        return this.getObject(this.#objectManagerPath)?.getInterface('org.freedesktop.DBus.ObjectManager')
    }

    /**
     * Getter for the name of this local service.
     * Returns the validated service name set during construction.
     *
     * @returns The service name as a string (e.g., 'org.example.Service').
     */
    public get name(): string {
        return this.#name
    }

    /**
     * Creates a service with its root object '/' and, unless objectManagerPath is null, an object manager.
     *
     * @example
     * new LocalService('org.example.Greeter')                                         // object manager at '/'
     * new LocalService('org.example.App', {objectManagerPath: '/org/example/App'})    // manages the objects below it
     *
     * @param serviceName - The well-known name to request, e.g. 'org.example.Service'.
     * @param opts - objectManagerPath: where the object manager is ('/' by default), or null for none.
     * @throws {LocalServiceInvalidNameError} If the name is not a valid DBus bus name.
     * @throws {LocalObjectInvalidNameError} If objectManagerPath is not a valid object path.
     */
    constructor(serviceName: string, opts: LocalServiceOpts = {}) {
        this.#name = this.validateDBusServiceName(serviceName)
        this.#objectManagerPath = opts.objectManagerPath === undefined ? '/' : opts.objectManagerPath
        // The root object always exists: it answers Introspect for '/' and is where clients start exploring
        this.addObject(new LocalObject('/'))
        if (this.#objectManagerPath !== null) {
            const managerObject: LocalObject = this.getObject(this.#objectManagerPath) ?? new LocalObject(this.#objectManagerPath)
            managerObject.addInterface(new ObjectManagerInterface())
            this.addObject(managerObject)
        }
    }

    /**
     * Handler for incoming DBus method call messages.
     * Processes method calls by routing them to the appropriate object and interface,
     * executing the method, and sending a reply (success or error) back to the caller.
     * Falls back to introspection handling if the target interface and method are for introspection
     * but the specific object or interface is not found.
     *
     * @param message - The DBusMessage containing the method call details (path, interface, method, etc.).
     * @returns A Promise that resolves when the method call is processed and a reply is sent.
     * @private
     */
    #methodCallHandler: (message: DBusMessage) => Promise<void> = async (message: DBusMessage): Promise<void> => {
        const targetObjectPath: string = message.header.path
        const targetInterface: string = message.header.interfaceName
        const targetMethod: string = message.header.member
        const payloadSignature: string = message.header.signature
        const localObject: LocalObject | undefined = this.getObject(targetObjectPath)
        if (localObject) {
            const localInterface: LocalInterface | undefined = localObject.getInterface(targetInterface)
            if (localInterface) {
                try {
                    const {
                        signature,
                        result
                    } = await localInterface.callMethod(targetMethod, payloadSignature, message.body, {
                        sender: message.header.sender,
                        objectPath: targetObjectPath,
                        interface: targetInterface,
                        method: targetMethod,
                        message: message
                    })
                    // parse() splits several output arguments (the handler returns them as an array) and keeps
                    // DBusSignedValue/DBusTypeClass results whose type already matches, instead of wrapping them again
                    const resultSignedValue: DBusSignedValue[] = signature ? DBusSignedValue.parse(signature, result) : []
                    return this.dbus.reply({
                        destination: message.header.sender,
                        replySerial: message.header.serial,
                        signature: signature,
                        data: resultSignedValue
                    })
                } catch (e: any) {
                    return this.dbus.reply({
                        destination: message.header.sender,
                        replySerial: message.header.serial,
                        signature: 's',
                        data: this.formatDBusError(e instanceof Error ? e : new Error(e.toString()))
                    })
                }
            }
        }
        /**
         * Introspect
         */
        if (targetInterface === 'org.freedesktop.DBus.Introspectable' && targetMethod === 'Introspect') {
            return this.dbus.reply({
                destination: message.header.sender,
                replySerial: message.header.serial,
                signature: 's',
                data: [this.#defaultIntrospectableInterface.formatIntrospectXML(targetObjectPath, this.listObjectPaths())]
            })
        }
        // If object or interface not found, reply with an error
        return this.dbus.reply({
            destination: message.header.sender,
            replySerial: message.header.serial,
            data: createDBusError('org.freedesktop.DBus.Error.UnknownObject', `Object path ${message.header.path} not found`)
        })
    }

    /**
     * Validates a DBus service name based on DBus naming rules.
     * Ensures the name is a non-empty string, within length limits, contains at least two elements
     * separated by dots, does not start or end with a dot, avoids consecutive dots, and uses
     * only allowed characters (letters, digits, underscores, hyphens) in each element.
     *
     * @param serviceName - The name to validate.
     * @returns The validated service name if it passes all checks.
     * @throws {LocalServiceInvalidNameError} If the name does not meet DBus naming criteria.
     */
    protected validateDBusServiceName(serviceName: string | any): string {
        // Step 1: Check if the input is a string and not empty
        if (typeof serviceName !== 'string' || serviceName.length === 0) {
            throw new LocalServiceInvalidNameError('Service name must be a non-empty string.')
        }

        // Step 2: Check length limit (maximum 255 bytes as per DBus spec)
        if (serviceName.length > 255) {
            throw new LocalServiceInvalidNameError('Service name exceeds 255 bytes.')
        }

        // Step 3: Check if it starts or ends with a dot, or contains consecutive dots
        if (serviceName.startsWith('.')) {
            throw new LocalServiceInvalidNameError('Service name cannot start with a dot.')
        }
        if (serviceName.endsWith('.')) {
            throw new LocalServiceInvalidNameError('Service name cannot end with a dot.')
        }
        if (serviceName.includes('..')) {
            throw new LocalServiceInvalidNameError('Service name cannot contain consecutive dots.')
        }

        // Step 4: Split the service name into elements and check if there are at least 2 elements
        const elements = serviceName.split('.')
        if (elements.length < 2) {
            throw new LocalServiceInvalidNameError('Service name must have at least two elements separated by dots.')
        }

        // Step 5: Validate each element for allowed characters and structure
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i]

            // Check if element is empty
            if (element.length === 0) {
                throw new LocalServiceInvalidNameError(`Element at position ${i + 1} is empty.`)
            }

            // Check if element starts with a hyphen
            if (element.startsWith('-')) {
                throw new LocalServiceInvalidNameError(`Element "${element}" at position ${i + 1} cannot start with a hyphen.`)
            }

            // Check if element contains only allowed characters (letters, digits, underscore, hyphen)
            for (let j = 0; j < element.length; j++) {
                const char = element[j]
                if (!/[a-zA-Z0-9_-]/.test(char)) {
                    throw new LocalServiceInvalidNameError(`Element "${element}" at position ${i + 1} contains invalid character "${char}".`)
                }
            }
        }

        // All checks passed, return the service name
        return serviceName
    }

    /**
     * Formats an error to ensure it has a valid DBus error name.
     * Appends the service name as a prefix if the error name does not match DBus naming conventions.
     * If the error name still doesn't match after prefixing, defaults to a generic error name with the service prefix.
     *
     * @param error - The error to format.
     * @returns The formatted error with a valid DBus error name (e.g., 'org.example.Service.Error').
     */
    protected formatDBusError(error: Error): Error {
        if (!this.#errorNameRegex.test(error.name)) {
            error.name = `${this.#name}.${error.name}`
            if (!this.#errorNameRegex.test(error.name)) error.name = `${this.#name}.Error`
        }
        return error
    }

    /**
     * Connects to the bus, starts answering method calls, and requests the service's name.
     *
     * A taken name does not make it fail: by default the service is queued and gets the name when the owner
     * releases it (DBUS_REQUEST_NAME_REPLY_IN_QUEUE). Check the result, or pass
     * `flags: RequestNameFlags.DBUS_NAME_FLAG_DO_NOT_QUEUE` to get DBUS_REQUEST_NAME_REPLY_EXISTS instead.
     *
     * @param opts - Where to connect, as for DBus.connect (the session bus by default), and `flags` for requesting
     *               the name.
     * @returns The result of requesting the name; DBUS_REQUEST_NAME_REPLY_PRIMARY_OWNER when the service owns it.
     * @throws {UnknownBusAddressError | CreateStreamFailedError | TimeoutError | AuthError} When connecting fails.
     */
    public async run(opts: RunServiceOpts = {}): Promise<RequestNameResultCode> {
        const flags: RequestNameFlags = opts.flags !== undefined ? opts.flags : RequestNameFlags.DBUS_NAME_FLAG_DEFAULT
        this.#stopping = false
        this.#dbus = await DBus.connect(opts) // Connect to the DBus bus
        this.dbus.on('methodCall', this.#onMethodCall) // Register handler for incoming method calls
        return await this.dbus.requestName(this.#name, flags) // Request ownership of the service name with specified flags
    }

    /**
     * Stops the service and disconnects from the DBus bus.
     * By default the name is released and the connection closed immediately; calls still being handled cannot be
     * answered any more. With `graceful`, new method calls are first answered with
     * org.freedesktop.DBus.Error.ServiceUnknown while the calls being handled finish (for at most `timeout`
     * milliseconds, if given), and only then is the name released and the connection closed.
     *
     * @param opts - Whether to stop gracefully, and how long to wait for calls being handled.
     * @returns A Promise that resolves when the service is stopped and disconnected from the bus.
     */
    public async stop(opts: StopServiceOpts = {}): Promise<void> {
        if (opts.graceful) {
            // Phase one: refuse new calls and let the ones being handled finish (within the timeout, if any)
            this.#stopping = true
            const finished: Promise<unknown> = Promise.allSettled([...this.#callsInProgress])
            if (opts.timeout === undefined) {
                await finished
            } else {
                let timer: NodeJS.Timeout | undefined
                await Promise.race([finished, new Promise<void>((resolve): void => {
                    timer = setTimeout(resolve, opts.timeout)
                })])
                clearTimeout(timer)
            }
        }
        // Phase two (or all of an immediate stop): give up the name and the connection
        await this.dbus.releaseName(this.#name) // Release ownership of the service name
        this.dbus.off('methodCall', this.#onMethodCall) // Remove the method call handler
        await this.dbus.disconnect() // Disconnect from the bus
    }

    /**
     * Whether a graceful stop is in progress, during which new method calls are refused.
     */
    #stopping: boolean = false

    /**
     * Method calls being handled, which a graceful stop waits for.
     */
    readonly #callsInProgress: Set<Promise<void>> = new Set()

    /**
     * Receives every method call: refuses it while stopping, otherwise handles it and tracks it until it is answered.
     * Errors left over after answering (e.g. the connection closed before the reply could be sent) are dropped
     * here, as nothing can be done about them and they must not become unhandled rejections.
     *
     * @param message - The method call.
     */
    #onMethodCall: (message: DBusMessage) => void = (message: DBusMessage): void => {
        if (this.#stopping) return this.#refuse(message)
        const call: Promise<void> = this.#methodCallHandler(message).catch((): void => undefined)
        this.#callsInProgress.add(call)
        call.finally((): boolean => this.#callsInProgress.delete(call))
    }

    /**
     * Answers a method call that arrives during a graceful stop.
     *
     * @param message - The method call.
     */
    #refuse(message: DBusMessage): void {
        if (message.header.flags & DBusMessageFlags.NO_REPLY_EXPECTED) return
        try {
            this.dbus.reply({
                destination: message.header.sender,
                replySerial: message.header.serial,
                data: createDBusError('org.freedesktop.DBus.Error.ServiceUnknown', `${this.#name} is stopping`)
            })
        } catch {
            // The connection is already closed
        }
    }

    /**
     * @internal
     * The object manager that reports the object at a path: the ObjectManagerInterface on the nearest object above
     * the path (never the object at the path itself).
     *
     * @param objectPath - The object's path.
     * @returns The manager, or undefined when no object above the path has one.
     */
    public objectManagerOf(objectPath: string): ObjectManagerInterface | undefined {
        let path: string = objectPath
        while (path !== '/') {
            path = path.substring(0, path.lastIndexOf('/')) || '/'
            const manager: ObjectManagerInterface | undefined = this.#objectMap.get(path)?.getInterface<ObjectManagerInterface>('org.freedesktop.DBus.ObjectManager')
            if (manager) return manager
        }
        return undefined
    }

    /**
     * @internal
     * Sends InterfacesAdded for interfaces of an object of this service, from the object's manager, while the service
     * runs. Their properties are read only then.
     *
     * @param localObject - The object.
     * @param interfaceNames - The names of the added interfaces.
     */
    public announceInterfacesAdded(localObject: LocalObject, interfaceNames: string[]): void {
        if (!this.#dbus?.connected || !interfaceNames.length) return
        const manager: ObjectManagerInterface | undefined = this.objectManagerOf(localObject.name)
        if (!manager) return
        const interfacesAndProperties: Record<string, Record<string, any>> = {}
        for (const interfaceName of interfaceNames) {
            const localInterface: LocalInterface | undefined = localObject.getInterface(interfaceName)
            if (localInterface) interfacesAndProperties[interfaceName] = localInterface.getManagedProperties()
        }
        manager.interfacesAdded(localObject.name, interfacesAndProperties)
    }

    /**
     * @internal
     * Sends InterfacesRemoved for interfaces of an object of this service, from the object's manager, while the
     * service runs.
     *
     * @param objectPath - The object's path.
     * @param interfaceNames - The names of the removed interfaces.
     */
    public announceInterfacesRemoved(objectPath: string, interfaceNames: string[]): void {
        if (!this.#dbus?.connected || !interfaceNames.length) return
        this.objectManagerOf(objectPath)?.interfacesRemoved(objectPath, interfaceNames)
    }

    /**
     * Adds an object. While the service runs, the object manager announces it with InterfacesAdded.
     *
     * @param localObject - The object to add.
     * @returns True when it was added, false when this object was already added.
     * @throws {LocalObjectPathExistsError} If another object has the same path ('/' always exists).
     */
    public addObject(localObject: LocalObject): boolean {
        let addSuccess: boolean = false
        if (this.#objectMap.has(localObject.name)) {
            if (this.#objectMap.get(localObject.name) !== localObject) {
                throw new LocalObjectPathExistsError(`Local object path ${localObject.name} exists`)
            } else {
                return addSuccess // Object already exists and is the same instance, no action needed
            }
        }
        localObject.setService(this) // Link the object to this service
        this.#objectMap.set(localObject.name, localObject)
        addSuccess = true
        if (addSuccess) this.announceInterfacesAdded(localObject, localObject.listInterfaceNames())
        return addSuccess
    }

    /**
     * Removes a LocalObject from this service by instance.
     * Unlinks the object from the service to prevent further operations and notifies the object manager
     * of the removal if an ObjectManager interface is available on the root object.
     *
     * @param localObject - The LocalObject instance to remove.
     * @returns A boolean indicating whether the object was successfully removed (true if removed, false if not found).
     */
    public removeObject(localObject: LocalObject): boolean

    /**
     * Removes a LocalObject from this service by object path.
     * Unlinks the object from the service to prevent further operations and notifies the object manager
     * of the removal if an ObjectManager interface is available on the root object.
     *
     * @param localObjectPath - The path of the object to remove.
     * @returns A boolean indicating whether the object was successfully removed (true if removed, false if not found).
     */
    public removeObject(localObjectPath: string): boolean

    /**
     * Removes a LocalObject from this service by instance or object path.
     * This method handles both string (object path) and LocalObject instance as input,
     * unlinking the object from the service and notifying the object manager of the removal
     * if an ObjectManager interface is available on the root object.
     *
     * @param inp - The object path or the LocalObject instance to remove.
     * @returns A boolean indicating whether the object was successfully removed (true if removed, false if not found).
     */
    public removeObject(inp: LocalObject | string): boolean {
        let removeSuccess: boolean
        let removedObject: LocalObject | undefined
        if (typeof inp === 'string') {
            // Case 1: Input is a string representing the object path.
            // Attempts to find and unset the associated service before deleting the object.
            this.#objectMap.get(inp)?.setService(undefined)
            removedObject = this.#objectMap.get(inp)
            removeSuccess = this.#objectMap.delete(inp)
        } else {
            // Case 2: Input is a LocalObject instance.
            // Finds the object by instance, unsets the associated service, and deletes it.
            const result: [string, LocalObject] | undefined = [...this.#objectMap.entries()].find(([localObjectPath, localObject]): boolean => localObject === inp)
            if (!result) {
                removeSuccess = false
            } else {
                result[1].setService(undefined)
                removedObject = result[1]
                removeSuccess = this.#objectMap.delete(result[0])
            }
        }
        if (removedObject && removeSuccess) this.announceInterfacesRemoved(removedObject.name, removedObject.listInterfaceNames())
        return removeSuccess
    }

    /**
     * Lists all objects associated with this service.
     * Provides a convenient way to inspect all objects currently linked to the service by returning
     * a record mapping object paths to their respective LocalObject instances.
     *
     * @returns A record mapping object paths to their LocalObject instances.
     */
    public getObjects(): LocalObject[] {
        return [...this.#objectMap.values()]
    }

    /**
     * Finds a LocalObject by its path.
     * Allows retrieval of a specific object by its object path with type casting for specialized object types.
     *
     * @param objectPath - The path of the object to find (e.g., '/org/example/Object').
     * @returns The LocalObject instance of the specified type if found, otherwise undefined.
     * @template T - The type of LocalObject to cast the result to (defaults to LocalObject).
     */
    public getObject<T extends LocalObject = LocalObject>(objectPath: string): T | undefined {
        return this.#objectMap.get(objectPath) as T
    }

    /**
     * Lists all object paths associated with this service.
     * Provides a quick way to retrieve just the paths of the objects for enumeration purposes.
     *
     * @returns An array of object paths as strings.
     */
    public listObjectPaths(): string[] {
        return [...this.#objectMap.keys()]
    }
}
