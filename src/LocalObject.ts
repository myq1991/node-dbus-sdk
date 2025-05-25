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

export class LocalObject {

    readonly #name: string

    #interfaceMap: Map<string, LocalInterface> = new Map()

    public service: LocalService | undefined

    /**
     * Getter for the DBus instance associated with this object's service.
     * @returns The DBus instance if the service is defined, otherwise undefined.
     */
    public get dbus(): DBus | undefined {
        if (!this.service) return
        return this.service.dbus
    }

    /**
     * Getter for the name (object path) of this local object.
     * @returns The object path as a string.
     */
    public get name(): string {
        return this.#name
    }

    /**
     * Getter for the Properties interface associated with this object.
     * @returns The PropertiesInterface instance for handling property-related operations.
     */
    public get propertiesInterface(): PropertiesInterface {
        return this.findInterfaceByName<PropertiesInterface>('org.freedesktop.DBus.Properties')!
    }

    /**
     * Getter for the Introspectable interface associated with this object.
     * @returns The IntrospectableInterface instance for handling introspection operations.
     */
    public get introspectableInterface(): IntrospectableInterface {
        return this.findInterfaceByName<IntrospectableInterface>('org.freedesktop.DBus.Introspectable')!
    }

    /**
     * Getter for the Peer interface associated with this object.
     * @returns The PeerInterface instance for handling peer-related operations.
     */
    public get peerInterface(): PeerInterface {
        return this.findInterfaceByName<PeerInterface>('org.freedesktop.DBus.Peer')!
    }

    /**
     * Constructor for LocalObject.
     * Initializes the object with a validated object path and adds standard DBus interfaces.
     * @param objectPath - The DBus object path to be validated and set.
     */
    constructor(objectPath: string) {
        this.#name = this.validateDBusObjectPath(objectPath)
        this.addInterface(new PropertiesInterface())
        this.addInterface(new IntrospectableInterface())
        this.addInterface(new PeerInterface())
    }

    /**
     * Validates a DBus object path based on DBus naming rules.
     * @param objectPath - The path to validate.
     * @returns The validated object path if it passes all checks.
     * @throws LocalObjectInvalidNameError if the path does not meet DBus naming criteria.
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
     * @param service - The LocalService to associate with this object, or undefined to clear the association.
     * @returns The instance of this LocalObject for method chaining.
     */
    public setService(service: LocalService | undefined): this {
        this.service = service
        return this
    }

    /**
     * Getter for the introspection data of this object.
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
     * @param localInterface - The LocalInterface instance to add.
     * @returns A boolean indicating whether the interface was successfully added.
     * @throws LocalInterfaceExistsError if an interface with the same name already exists and is not the same instance.
     */
    public addInterface(localInterface: LocalInterface): boolean {
        let addSuccess: boolean = false
        if (this.#interfaceMap.has(localInterface.name)) {
            if (this.#interfaceMap.get(localInterface.name) !== localInterface) {
                throw new LocalInterfaceExistsError(`Local interface ${localInterface.name} exists`)
            } else {
                return addSuccess
            }
        }
        localInterface.setObject(this)
        this.#interfaceMap.set(localInterface.name, localInterface)
        addSuccess = true
        if (addSuccess) {
            const addedInterfaceRecord: Record<string, Record<string, any>> = {}
            localInterface.getManagedProperties().then((record: Record<string, DBusSignedValue>): void => {
                addedInterfaceRecord[localInterface.name] = record
                this.service?.objectManager?.interfacesAdded(this, addedInterfaceRecord)
            }).catch((): void => {
                this.service?.objectManager?.interfacesAdded(this, {})
            })
        }
        return addSuccess
    }

    /**
     * Removes a LocalInterface from this object by name.
     * @param interfaceName - The name of the interface to remove.
     * @returns A boolean indicating whether the interface was successfully removed.
     */
    public removeInterface(interfaceName: string): boolean

    /**
     * Removes a LocalInterface from this object by instance.
     * @param localInterface - The LocalInterface instance to remove.
     * @returns A boolean indicating whether the interface was successfully removed.
     */
    public removeInterface(localInterface: LocalInterface): boolean

    /**
     * Removes a LocalInterface from this object by name or instance.
     * This method handles both string (interface name) and LocalInterface instance as input.
     * @param inp - The name of the interface or the LocalInterface instance to remove.
     * @returns A boolean indicating whether the interface was successfully removed.
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
        if (removedInterface && removeSuccess) this.service?.objectManager?.interfacesRemoved(this, [removedInterface.name])
        return removeSuccess
    }

    /**
     * Lists all interfaces associated with this object.
     * @returns A record mapping interface names to their LocalInterface instances.
     */
    public listInterfaces(): Record<string, LocalInterface> {
        const interfaces: Record<string, LocalInterface> = {}
        this.#interfaceMap.forEach((localInterface: LocalInterface, interfaceName: string): LocalInterface => interfaces[interfaceName] = localInterface)
        return interfaces
    }

    public interfaceNames(): string[] {
        return [...this.#interfaceMap.keys()]
    }

    /**
     * Finds a LocalInterface by its name.
     * @param name - The name of the interface to find.
     * @returns The LocalInterface instance of the specified type if found, otherwise undefined.
     */
    public findInterfaceByName<T extends LocalInterface = LocalInterface>(name: string): T | undefined {
        return this.#interfaceMap.get(name) as T
    }

    public async getManagedInterfaces(): Promise<Record<string, Record<string, DBusSignedValue>>> {
        const record: Record<string, Record<string, DBusSignedValue>> = {}
        for (const interfaceName of this.interfaceNames()) {
            record[interfaceName] = await this.#interfaceMap.get(interfaceName)!.getManagedProperties()
        }
        return record
    }
}
