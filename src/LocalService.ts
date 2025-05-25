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

export class LocalService {

    readonly #errorNameRegex: RegExp = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/

    readonly #name: string

    readonly #objectMap: Map<string, LocalObject> = new Map()

    readonly #defaultIntrospectableInterface: IntrospectableInterface = new IntrospectableInterface()

    public dbus: DBus

    public get objectManager(): ObjectManagerInterface | undefined {
        return this.findObjectByPath('/')?.findInterfaceByName('org.freedesktop.DBus.ObjectManager')
    }

    /**
     * Getter for the name of this local service.
     * @returns The service name as a string.
     */
    public get name(): string {
        return this.#name
    }

    /**
     * Constructor for LocalService.
     * Initializes the service with a validated service name.
     * @param serviceName - The DBus service name to be validated and set.
     */
    constructor(serviceName: string) {
        this.#name = this.validateDBusServiceName(serviceName)
        this.addObject(new RootObject())
    }

    /**
     * Handler for incoming DBus method call messages.
     * Processes method calls by routing them to the appropriate object and interface.
     * @param message - The DBusMessage containing the method call details.
     * @returns A Promise that resolves when the method call is processed and a reply is sent.
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
        return this.dbus.reply({
            destination: message.header.sender,
            replySerial: message.header.serial,
            data: CreateDBusError('org.freedesktop.DBus.Error.UnknownObject', `Object path ${message.header.path} not found`)
        })
    }

    /**
     * Validates a DBus service name based on DBus naming rules.
     * @param serviceName - The name to validate.
     * @returns The validated service name if it passes all checks.
     * @throws LocalServiceInvalidNameError if the name does not meet DBus naming criteria.
     */
    protected validateDBusServiceName(serviceName: string | any): string {
        // Step 1: Check if the input is a string and not empty
        if (typeof serviceName !== 'string' || serviceName.length === 0) {
            throw new LocalServiceInvalidNameError('Service name must be a non-empty string.')
        }

        // Step 2: Check length limit (maximum 255 bytes)
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

        // Step 5: Validate each element
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
     * @param error - The error to format.
     * @returns The formatted error with a valid DBus error name.
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
     * @param opts - Connection options for the DBus bus.
     * @returns A Promise that resolves when the service is successfully running.
     */
    public async run(opts: ConnectOpts): Promise<void> {
        this.dbus = await DBus.connect(opts)
        this.dbus.on('methodCall', this.#methodCallHandler)
        await this.dbus.requestName(this.#name)
    }

    /**
     * Stops the service and disconnects from the DBus bus.
     * @returns A Promise that resolves when the service is stopped and disconnected.
     */
    public async stop(): Promise<void> {
        await this.dbus.releaseName(this.#name)
        this.dbus.off('methodCall', this.#methodCallHandler)
        await this.dbus.disconnect()
    }

    /**
     * Adds a LocalObject to this service.
     * @param localObject - The LocalObject instance to add.
     * @returns A boolean indicating whether the object was successfully added.
     * @throws LocalObjectPathExistsError if an object with the same path already exists and is not the same instance.
     */
    public addObject(localObject: LocalObject): boolean {
        let addSuccess: boolean = false
        if (this.#objectMap.has(localObject.name)) {
            if (this.#objectMap.get(localObject.name) !== localObject) {
                throw new LocalObjectPathExistsError(`Local object path ${localObject.name} exists`)
            } else {
                return addSuccess
            }
        }
        localObject.setService(this)
        this.#objectMap.set(localObject.name, localObject)
        addSuccess = true
        if (addSuccess) localObject
            .getManagedInterfaces()
            .then((managedInterfaces: Record<string, Record<string, DBusSignedValue>>): void => this.objectManager?.interfacesAdded(localObject, managedInterfaces))
            .catch((): void => this.objectManager?.interfacesAdded(localObject, {}))
        return addSuccess
    }

    /**
     * Removes a LocalObject from this service by instance.
     * @param localObject - The LocalObject instance to remove.
     * @returns A boolean indicating whether the object was successfully removed.
     */
    public removeObject(localObject: LocalObject): boolean

    /**
     * Removes a LocalObject from this service by object path.
     * @param localObjectPath - The path of the object to remove.
     * @returns A boolean indicating whether the object was successfully removed.
     */
    public removeObject(localObjectPath: string): boolean

    /**
     * Removes a LocalObject from this service by instance or object path.
     * This method handles both string (object path) and LocalObject instance as input.
     * @param inp - The object path or the LocalObject instance to remove.
     * @returns A boolean indicating whether the object was successfully removed.
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
        if (removedObject && removeSuccess) this.objectManager?.interfacesRemoved(removedObject, removedInterfaceNames ? removedInterfaceNames : [])
        return removeSuccess
    }

    /**
     * Lists all objects associated with this service.
     * @returns A record mapping object paths to their LocalObject instances.
     */
    public listObjects(): Record<string, LocalObject> {
        const objects: Record<string, LocalObject> = {}
        this.#objectMap.forEach((localObject: LocalObject, objectPath: string): LocalObject => objects[objectPath] = localObject)
        return objects
    }

    /**
     * Finds a LocalObject by its path.
     * @param objectPath - The path of the object to find.
     * @returns The LocalObject instance of the specified type if found, otherwise undefined.
     */
    public findObjectByPath<T extends LocalObject = LocalObject>(objectPath: string): T | undefined {
        return this.#objectMap.get(objectPath) as T
    }

    /**
     * Lists all object paths associated with this service.
     * @returns An array of object paths as strings.
     */
    public listObjectPaths(): string[] {
        return [...this.#objectMap.keys()]
    }
}
