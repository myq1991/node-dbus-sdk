import {LocalInterface} from '../../LocalInterface'
import EventEmitter from 'node:events'

/**
 * org.freedesktop.DBus.ObjectManager for a LocalService: GetManagedObjects lists the objects below this interface's
 * object with their interfaces and properties, and InterfacesAdded / InterfacesRemoved announce objects and
 * interfaces as they are added and removed.
 *
 * A LocalService has one on '/' by default (see LocalServiceOpts.objectManagerPath). Adding one to another object
 * nests a manager: each object is reported by the nearest manager above it.
 *
 * @example
 * const sub = new LocalObject('/org/example/Sub')
 * sub.addInterface(new ObjectManagerInterface())   // reports the objects below /org/example/Sub
 * service.addObject(sub)
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
     * The objects this manager reports with their interfaces and readable properties: the objects below its own
     * path whose nearest manager it is (an object below a nested manager belongs to that one), not its own object.
     *
     * @returns {object path: {interface: {property: value}}}.
     */
    protected getManagedObjects(): Record<string, Record<string, Record<string, any>>> {
        const managedObjects: Record<string, Record<string, Record<string, any>>> = {}
        const service = this.object?.service
        if (!service) return managedObjects
        for (const object of service.getObjects()) {
            if (service.objectManagerOf(object.name) === this) managedObjects[object.name] = object.getManagedInterfaces()
        }
        return managedObjects
    }

    /**
     * @internal
     * Sends InterfacesAdded for an object this manager reports.
     *
     * @param objectPath - The object's path.
     * @param interfacesAndProperties - The added interfaces with their readable properties.
     */
    public interfacesAdded(objectPath: string, interfacesAndProperties: Record<string, Record<string, any>>): void {
        this.#eventEmitter.emit('InterfacesAdded', objectPath, interfacesAndProperties)
    }

    /**
     * @internal
     * Sends InterfacesRemoved for an object this manager reports.
     *
     * @param objectPath - The object's path.
     * @param interfaces - The names of the removed interfaces.
     */
    public interfacesRemoved(objectPath: string, interfaces: string[]): void {
        this.#eventEmitter.emit('InterfacesRemoved', objectPath, interfaces)
    }
}
