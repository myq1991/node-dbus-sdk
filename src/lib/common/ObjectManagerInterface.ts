import {LocalInterface} from '../../LocalInterface'
import EventEmitter from 'node:events'
import {LocalObject} from '../../LocalObject'

/**
 * A class representing the DBus ObjectManager interface.
 * Implements the 'org.freedesktop.DBus.ObjectManager' interface, which provides
 * functionality for managing a hierarchy of objects and their interfaces.
 * This interface allows clients to retrieve all managed objects and receive signals
 * when interfaces are added or removed from objects.
 */
export class ObjectManagerInterface extends LocalInterface {

    /**
     * An EventEmitter instance used to emit signals for interface changes.
     * Handles the 'InterfacesAdded' and 'InterfacesRemoved' signals to notify
     * clients of updates to the object hierarchy.
     */
    #eventEmitter: EventEmitter = new EventEmitter()

    /**
     * Constructor for the ObjectManagerInterface.
     * Initializes the interface with the name 'org.freedesktop.DBus.ObjectManager'
     * and defines the 'GetManagedObjects' method to retrieve all managed objects,
     * as well as 'InterfacesAdded' and 'InterfacesRemoved' signals to notify about changes.
     */
    constructor() {
        super('org.freedesktop.DBus.ObjectManager')
        this.defineMethod({
            name: 'GetManagedObjects',
            outputArgs: [{
                type: 'a{oa{sa{sv}}}' // Array of object paths mapping to interfaces and their properties
            }],
            method: async (): Promise<Record<string, Record<string, Record<string, any>>>> => this.getManagedObjects()
            // Retrieves a nested structure of all managed objects, their interfaces, and properties.
        })
            .defineSignal({
                name: 'InterfacesAdded',
                args: [
                    {
                        name: 'object_path',
                        type: 'o' // Object path type for the affected object
                    },
                    {
                        name: 'interfaces_and_properties',
                        type: 'a{sa{sv}}' // Array of interfaces and their properties added to the object
                    }
                ],
                eventEmitter: this.#eventEmitter
                // Signal emitted when interfaces are added to an object.
            })
            .defineSignal({
                name: 'InterfacesRemoved',
                args: [
                    {
                        name: 'object_path',
                        type: 'o' // Object path type for the affected object
                    },
                    {
                        name: 'interfaces',
                        type: 'as' // Array of strings representing the names of removed interfaces
                    }
                ],
                eventEmitter: this.#eventEmitter
                // Signal emitted when interfaces are removed from an object.
            })
    }

    /**
     * Retrieves all managed objects, their interfaces, and properties.
     * Iterates through all objects in the associated service and collects their
     * managed interfaces and properties into a nested structure.
     * If no service or objects are available, returns an empty record.
     *
     * @returns A record mapping object paths to their interfaces
     *          and properties as a nested structure (Record<string, Record<string, Record<string, any>>>).
     */
    protected getManagedObjects(): Record<string, Record<string, Record<string, any>>> {
        const managedObjects: Record<string, Record<string, Record<string, any>>> = {}
        const objects: Record<string, LocalObject> | undefined = this.object?.service?.listObjects()
        if (!objects) return managedObjects
        for (const objectPath in objects) {
            const object: LocalObject = objects[objectPath]
            managedObjects[objectPath] = object.getManagedInterfaces()
        }
        return managedObjects
    }

    /**
     * Emits the 'InterfacesAdded' signal to notify clients of new interfaces.
     * Triggered when one or more interfaces are added to a specific object.
     * The signal includes the object path and a record of the added interfaces along with their properties.
     *
     * @param localObject - The LocalObject instance to which interfaces were added.
     * @param interfacesAndProperties - A record mapping interface names to their properties and values.
     */
    public interfacesAdded(localObject: LocalObject, interfacesAndProperties: Record<string, Record<string, any>>): void {
        this.#eventEmitter.emit('InterfacesAdded', localObject.name, interfacesAndProperties)
    }

    /**
     * Emits the 'InterfacesRemoved' signal to notify clients of removed interfaces.
     * Triggered when one or more interfaces are removed from a specific object.
     * The signal includes the object path and an array of the names of the removed interfaces.
     *
     * @param localObject - The LocalObject instance from which interfaces were removed.
     * @param interfaces - An array of interface names that were removed from the object.
     */
    public interfacesRemoved(localObject: LocalObject, interfaces: string[]): void {
        this.#eventEmitter.emit('InterfacesRemoved', localObject.name, interfaces)
    }
}
