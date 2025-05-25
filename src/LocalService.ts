import {LocalObject} from './LocalObject'
import {ConnectOpts} from './types/ConnectOpts'
import {DBus} from './DBus'
import {DBusMessage} from './lib/DBusMessage'
import {LocalObjectPathExistsError, LocalServiceInvalidNameError} from './lib/Errors'
import {IntrospectableInterface} from './lib/common/IntrospectableInterface'
import {LocalInterface} from './LocalInterface'
import {DBusSignedValue} from './lib/DBusSignedValue'
import {CreateDBusError} from './lib/CreateDBusError'
import {RootObject} from './lib/common/RootObject'
import {ObjectManagerInterface} from './lib/common/ObjectManagerInterface'

/**
 * A class representing a local DBus service.
 * This class manages a collection of objects and their associated interfaces within a DBus service.
 * It handles connecting to a DBus bus, processing incoming method calls, and managing the lifecycle
 * of the service. It serves as the top-level entity for a local DBus service implementation.
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

    /**
     * The DBus instance associated with this service.
     * Provides the connection to the DBus bus for communication and message handling.
     */
    public dbus: DBus

    /**
     * Getter for the ObjectManager interface associated with this service.
     * Provides access to the 'org.freedesktop.DBus.ObjectManager' interface on the root object,
     * if available, for managing object hierarchies.
     *
     * @returns The ObjectManagerInterface instance if found on the root object, otherwise undefined.
     */
    public get objectManager(): ObjectManagerInterface | undefined {
        return this.findObjectByPath('/')?.findInterfaceByName('org.freedesktop.DBus.ObjectManager')
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
     * Constructor for LocalService.
     * Initializes the service with a validated service name and adds a root object
     * to serve as the base of the object hierarchy.
     *
     * @param serviceName - The DBus service name to be validated and set (e.g., 'org.example.Service').
     * @throws {LocalServiceInvalidNameError} If the provided name does not meet DBus naming criteria.
     */
    constructor(serviceName: string) {
        this.#name = this.validateDBusServiceName(serviceName)
        this.addObject(new RootObject()) // Add root object as the base of the hierarchy
    }

    /**
     * Handler for incoming DBus method call messages.
     * Processes method calls by routing them to the appropriate object and interface,
     * executing the method, and sending a reply (success or error) back to the caller.
     * Falls back to introspection handling if the target is not found but introspection is requested.
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
        const localObject: LocalObject | undefined = this.findObjectByPath(targetObjectPath)
        if (localObject) {
            const localInterface: LocalInterface | undefined = localObject.findInterfaceByName(targetInterface)
            if (localInterface) {
                try {
                    const {
                        signature,
                        result
                    } = await localInterface.callMethod(targetMethod, payloadSignature, ...message.body)
                    const resultSignedValue: DBusSignedValue[] = signature ? [new DBusSignedValue(signature!, result)] : []
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
            data: CreateDBusError('org.freedesktop.DBus.Error.UnknownObject', `Object path ${message.header.path} not found`)
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
     * Connects to a DBus bus and starts the service.
     * Establishes a connection to the bus, registers the method call handler,
     * and requests ownership of the service name on the bus.
     *
     * @param opts - Connection options for the DBus bus (e.g., socket path, TCP details).
     * @returns A Promise that resolves when the service is successfully running and connected to the bus.
     */
    public async run(opts: ConnectOpts): Promise<void> {
        this.dbus = await DBus.connect(opts) // Connect to the DBus bus
        this.dbus.on('methodCall', this.#methodCallHandler) // Register handler for incoming method calls
        await this.dbus.requestName(this.#name) // Request ownership of the service name
    }

    /**
     * Stops the service and disconnects from the DBus bus.
     * Releases ownership of the service name, removes the method call handler,
     * and closes the connection to the bus.
     *
     * @returns A Promise that resolves when the service is stopped and disconnected from the bus.
     */
    public async stop(): Promise<void> {
        await this.dbus.releaseName(this.#name) // Release ownership of the service name
        this.dbus.off('methodCall', this.#methodCallHandler) // Remove the method call handler
        await this.dbus.disconnect() // Disconnect from the bus
    }

    /**
     * Adds a LocalObject to this service.
     * Associates the object with this service, linking it to the service's context,
     * and notifies the object manager of the addition if applicable.
     *
     * @param localObject - The LocalObject instance to add to this service.
     * @returns A boolean indicating whether the object was successfully added (true if added, false if already present).
     * @throws {LocalObjectPathExistsError} If an object with the same path already exists and is not the same instance.
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
        if (addSuccess) this.objectManager?.interfacesAdded(localObject, localObject.getManagedInterfaces())
        return addSuccess
    }

    /**
     * Removes a LocalObject from this service by instance.
     * Unlinks the object from the service and notifies the object manager of the removal.
     *
     * @param localObject - The LocalObject instance to remove.
     * @returns A boolean indicating whether the object was successfully removed (true if removed, false if not found).
     */
    public removeObject(localObject: LocalObject): boolean

    /**
     * Removes a LocalObject from this service by object path.
     * Unlinks the object from the service and notifies the object manager of the removal.
     *
     * @param localObjectPath - The path of the object to remove.
     * @returns A boolean indicating whether the object was successfully removed (true if removed, false if not found).
     */
    public removeObject(localObjectPath: string): boolean

    /**
     * Removes a LocalObject from this service by instance or object path.
     * This method handles both string (object path) and LocalObject instance as input,
     * unlinking the object and notifying the object manager of the removal.
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
        const removedInterfaceNames: string[] | undefined = removedObject?.interfaceNames()
        // If removal was successful, notify the object manager of the removed interfaces
        if (removedObject && removeSuccess) this.objectManager?.interfacesRemoved(removedObject, removedInterfaceNames ? removedInterfaceNames : [])
        return removeSuccess
    }

    /**
     * Lists all objects associated with this service.
     * Provides a convenient way to inspect all objects currently linked to the service.
     *
     * @returns A record mapping object paths to their LocalObject instances.
     */
    public listObjects(): Record<string, LocalObject> {
        const objects: Record<string, LocalObject> = {}
        this.#objectMap.forEach((localObject: LocalObject, objectPath: string): LocalObject => objects[objectPath] = localObject)
        return objects
    }

    /**
     * Finds a LocalObject by its path.
     * Allows retrieval of a specific object with type casting for specialized object types.
     *
     * @param objectPath - The path of the object to find (e.g., '/org/example/Object').
     * @returns The LocalObject instance of the specified type if found, otherwise undefined.
     * @template T - The type of LocalObject to cast the result to (defaults to LocalObject).
     */
    public findObjectByPath<T extends LocalObject = LocalObject>(objectPath: string): T | undefined {
        return this.#objectMap.get(objectPath) as T
    }

    /**
     * Lists all object paths associated with this service.
     * Provides a quick way to retrieve just the paths of the objects for enumeration.
     *
     * @returns An array of object paths as strings.
     */
    public listObjectPaths(): string[] {
        return [...this.#objectMap.keys()]
    }
}
