import {LocalInterface} from './LocalInterface'
import {LocalInterfaceExistsError, LocalObjectInvalidNameError} from './lib/Errors'
import {DBus} from './DBus'
import {LocalService} from './LocalService'
import {IntrospectNode} from './types/IntrospectNode'
import {IntrospectInterface} from './types/IntrospectInterface'
import {IntrospectableInterface} from './lib/common/IntrospectableInterface'
import {PropertiesInterface} from './lib/common/PropertiesInterface'
import {PeerInterface} from './lib/common/PeerInterface'
import {DBusSignedValue} from './lib/DBusSignedValue'

/**
 * A class representing a local DBus object.
 * This class manages a collection of interfaces associated with a specific object path
 * within a local DBus service. It provides methods to add, remove, and query interfaces,
 * as well as to access standard DBus interfaces like Properties and Introspectable.
 * It serves as a container for interfaces under a unique object path.
 */
export class LocalObject {

    /**
     * The name of this object, representing its DBus object path.
     * This uniquely identifies the object within a service (e.g., '/org/example/Object').
     */
    readonly #name: string

    /**
     * A map of interface names to their corresponding LocalInterface instances.
     * Stores all interfaces associated with this object for quick lookup and management.
     */
    #interfaceMap: Map<string, LocalInterface> = new Map()

    /**
     * The LocalService instance associated with this object, if any.
     * Links the object to a specific service within a DBus connection for context.
     */
    public service: LocalService | undefined

    /**
     * Getter for the DBus instance associated with this object's service.
     * Provides access to the DBus connection for operations like signal emission.
     *
     * @returns The DBus instance if the service is defined, otherwise undefined.
     */
    public get dbus(): DBus | undefined {
        if (!this.service) return
        return this.service.dbus
    }

    /**
     * Getter for the name (object path) of this local object.
     * Returns the validated object path set during construction.
     *
     * @returns The object path as a string (e.g., '/org/example/Object').
     */
    public get name(): string {
        return this.#name
    }

    /**
     * Getter for the Properties interface associated with this object.
     * Provides access to the standard 'org.freedesktop.DBus.Properties' interface
     * for handling property-related operations across all interfaces on this object.
     *
     * @returns The PropertiesInterface instance for handling property-related operations.
     */
    public get propertiesInterface(): PropertiesInterface {
        return this.findInterfaceByName<PropertiesInterface>('org.freedesktop.DBus.Properties')!
    }

    /**
     * Getter for the Introspectable interface associated with this object.
     * Provides access to the standard 'org.freedesktop.DBus.Introspectable' interface
     * for handling introspection operations to describe the object's structure.
     *
     * @returns The IntrospectableInterface instance for handling introspection operations.
     */
    public get introspectableInterface(): IntrospectableInterface {
        return this.findInterfaceByName<IntrospectableInterface>('org.freedesktop.DBus.Introspectable')!
    }

    /**
     * Getter for the Peer interface associated with this object.
     * Provides access to the standard 'org.freedesktop.DBus.Peer' interface
     * for handling peer-related operations like ping and machine ID retrieval.
     *
     * @returns The PeerInterface instance for handling peer-related operations.
     */
    public get peerInterface(): PeerInterface {
        return this.findInterfaceByName<PeerInterface>('org.freedesktop.DBus.Peer')!
    }

    /**
     * Constructor for LocalObject.
     * Initializes the object with a validated object path and adds standard DBus interfaces
     * (Properties, Introspectable, and Peer) for compliance with DBus conventions.
     *
     * @param objectPath - The DBus object path to be validated and set (e.g., '/org/example/Object').
     * @throws {LocalObjectInvalidNameError} If the provided object path does not meet DBus naming criteria.
     */
    constructor(objectPath: string) {
        this.#name = this.validateDBusObjectPath(objectPath)
        // Add standard DBus interfaces required for most objects
        this.addInterface(new PropertiesInterface())
        this.addInterface(new IntrospectableInterface())
        this.addInterface(new PeerInterface())
    }

    /**
     * Validates a DBus object path based on DBus naming rules.
     * Ensures the path is a non-empty string, within length limits, starts with a slash,
     * does not end with a slash (except for root path '/'), avoids consecutive slashes,
     * and uses only allowed characters (letters, digits, underscores) in each element.
     *
     * @param objectPath - The path to validate.
     * @returns The validated object path if it passes all checks.
     * @throws {LocalObjectInvalidNameError} If the path does not meet DBus naming criteria.
     */
    protected validateDBusObjectPath(objectPath: string | any): string {
        // Step 1: Check if the input is a string and not empty
        if (typeof objectPath !== 'string' || objectPath.length === 0) {
            throw new LocalObjectInvalidNameError('Object path must be a non-empty string.')
        }

        // Step 2: Check length limit (maximum 255 bytes, consistent with bus name limit)
        if (objectPath.length > 255) {
            throw new LocalObjectInvalidNameError('Object path exceeds 255 bytes.')
        }

        // Step 3: Check if it starts with a slash
        if (!objectPath.startsWith('/')) {
            throw new LocalObjectInvalidNameError('Object path must start with a slash (/).')
        }

        // Step 4: Special case: root path "/"
        if (objectPath === '/') {
            return objectPath
        }

        // Step 5: Check if it ends with a slash (disallowed except for root path)
        if (objectPath.endsWith('/')) {
            throw new LocalObjectInvalidNameError('Object path cannot end with a slash (except for root path /).')
        }

        // Step 6: Check for consecutive slashes
        if (objectPath.includes('//')) {
            throw new LocalObjectInvalidNameError('Object path cannot contain consecutive slashes (//).')
        }

        // Step 7: Split the object path into elements (remove leading slash first)
        const elements = objectPath.slice(1).split('/')

        // Step 8: Validate each element
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i]

            // Check if element is empty (should not happen after previous checks, but for safety)
            if (element.length === 0) {
                throw new LocalObjectInvalidNameError(`Element at position ${i + 1} is empty.`)
            }

            // Check if element starts with a digit
            if (element.match(/^[0-9]/)) {
                throw new LocalObjectInvalidNameError(`Element "${element}" at position ${i + 1} cannot start with a digit.`)
            }

            // Check if element contains only allowed characters (letters, digits, underscore)
            for (let j = 0; j < element.length; j++) {
                const char = element[j]
                if (!/[a-zA-Z0-9_]/.test(char)) {
                    throw new LocalObjectInvalidNameError(`Element "${element}" at position ${i + 1} contains invalid character "${char}".`)
                }
            }
        }

        // All checks passed, return the object path
        return objectPath
    }

    /**
     * Sets the LocalService associated with this object.
     * Links the object to a specific service within a DBus connection for context during operations.
     *
     * @param service - The LocalService to associate with this object, or undefined to clear the association.
     * @returns The instance of this LocalObject for method chaining.
     */
    public setService(service: LocalService | undefined): this {
        this.service = service
        return this
    }

    /**
     * Getter for the introspection data of this object.
     * Provides metadata about all interfaces associated with this object for DBus introspection.
     *
     * @returns An IntrospectNode object containing the introspection data for all interfaces associated with this object.
     */
    public get introspectNode(): IntrospectNode {
        const interfaces: IntrospectInterface[] = []
        this.#interfaceMap.forEach((localInterface: LocalInterface): void => {
            interfaces.push(localInterface.introspectInterface)
        })
        return {
            interface: interfaces
        }
    }

    /**
     * Adds a LocalInterface to this object.
     * Associates the interface with this object, linking it to the object's context,
     * and notifies the service's object manager of the addition if applicable.
     *
     * @param localInterface - The LocalInterface instance to add to this object.
     * @returns A boolean indicating whether the interface was successfully added (true if added, false if already present).
     * @throws {LocalInterfaceExistsError} If an interface with the same name already exists and is not the same instance.
     */
    public addInterface(localInterface: LocalInterface): boolean {
        let addSuccess: boolean = false
        if (this.#interfaceMap.has(localInterface.name)) {
            if (this.#interfaceMap.get(localInterface.name) !== localInterface) {
                throw new LocalInterfaceExistsError(`Local interface ${localInterface.name} exists`)
            } else {
                return addSuccess // Interface already exists and is the same instance, no action needed
            }
        }
        localInterface.setObject(this) // Link the interface to this object
        this.#interfaceMap.set(localInterface.name, localInterface)
        addSuccess = true
        if (addSuccess) {
            const addedInterfaceRecord: Record<string, Record<string, any>> = {}
            // Fetch managed properties asynchronously and notify the object manager
            addedInterfaceRecord[localInterface.name] = localInterface.getManagedProperties()
            this.service?.objectManager?.interfacesAdded(this, addedInterfaceRecord)
        }
        return addSuccess
    }

    /**
     * Removes a LocalInterface from this object by name.
     * Unlinks the interface from the object and notifies the service's object manager of the removal.
     *
     * @param interfaceName - The name of the interface to remove.
     * @returns A boolean indicating whether the interface was successfully removed (true if removed, false if not found).
     */
    public removeInterface(interfaceName: string): boolean

    /**
     * Removes a LocalInterface from this object by instance.
     * Unlinks the interface from the object and notifies the service's object manager of the removal.
     *
     * @param localInterface - The LocalInterface instance to remove.
     * @returns A boolean indicating whether the interface was successfully removed (true if removed, false if not found).
     */
    public removeInterface(localInterface: LocalInterface): boolean

    /**
     * Removes a LocalInterface from this object by name or instance.
     * This method handles both string (interface name) and LocalInterface instance as input,
     * unlinking the interface and notifying the object manager of the removal.
     *
     * @param inp - The name of the interface or the LocalInterface instance to remove.
     * @returns A boolean indicating whether the interface was successfully removed (true if removed, false if not found).
     */
    public removeInterface(inp: LocalInterface | string): boolean {
        let removeSuccess: boolean
        let removedInterface: LocalInterface | undefined
        if (typeof inp === 'string') {
            // Case 1: Input is a string representing the interface name.
            // Attempts to find and unset the associated object before deleting the interface.
            this.#interfaceMap.get(inp)?.setObject(undefined)
            removedInterface = this.#interfaceMap.get(inp)
            removeSuccess = this.#interfaceMap.delete(inp)
        } else {
            // Case 2: Input is a LocalInterface instance.
            // Finds the interface by instance, unsets the associated object, and deletes it.
            const result: [string, LocalInterface] | undefined = [...this.#interfaceMap.entries()].find(([interfaceName, localInterface]): boolean => localInterface === inp)
            if (!result) {
                removeSuccess = false
            } else {
                result[1].setObject(undefined)
                removedInterface = result[1]
                removeSuccess = this.#interfaceMap.delete(result[0])
            }
        }
        // If removal was successful, notify the object manager of the removed interface
        if (removedInterface && removeSuccess) this.service?.objectManager?.interfacesRemoved(this, [removedInterface.name])
        return removeSuccess
    }

    /**
     * Lists all interfaces associated with this object.
     * Provides a convenient way to inspect all interfaces currently linked to the object.
     *
     * @returns A record mapping interface names to their LocalInterface instances.
     */
    public listInterfaces(): Record<string, LocalInterface> {
        const interfaces: Record<string, LocalInterface> = {}
        this.#interfaceMap.forEach((localInterface: LocalInterface, interfaceName: string): LocalInterface => interfaces[interfaceName] = localInterface)
        return interfaces
    }

    /**
     * Lists the names of all interfaces associated with this object.
     * Provides a quick way to retrieve just the names of the interfaces for enumeration.
     *
     * @returns An array of interface names as strings.
     */
    public interfaceNames(): string[] {
        return [...this.#interfaceMap.keys()]
    }

    /**
     * Finds a LocalInterface by its name.
     * Allows retrieval of a specific interface with type casting for specialized interface types.
     *
     * @param name - The name of the interface to find (e.g., 'org.example.MyInterface').
     * @returns The LocalInterface instance of the specified type if found, otherwise undefined.
     * @template T - The type of LocalInterface to cast the result to (defaults to LocalInterface).
     */
    public findInterfaceByName<T extends LocalInterface = LocalInterface>(name: string): T | undefined {
        return this.#interfaceMap.get(name) as T
    }

    /**
     * Gets all managed interfaces and their properties as a record.
     * Retrieves the current properties of all interfaces on this object as DBusSignedValue instances.
     *
     * @returns A Promise resolving to a record mapping interface names to their property records (property name to DBusSignedValue).
     */
    public getManagedInterfaces(): Record<string, Record<string, DBusSignedValue>> {
        const record: Record<string, Record<string, DBusSignedValue>> = {}
        for (const interfaceName of this.interfaceNames()) {
            record[interfaceName] = this.#interfaceMap.get(interfaceName)!.getManagedProperties()
        }
        return record
    }
}
