import {LocalInterface} from '../../LocalInterface'
import EventEmitter from 'node:events'
import {CreateDBusError} from '../CreateDBusError'

/**
 * A class representing the DBus Properties interface.
 * This interface provides methods to get, set, and monitor properties of other interfaces
 * on a DBus object. Implements the 'org.freedesktop.DBus.Properties' interface.
 */
export class PropertiesInterface extends LocalInterface {

    /**
     * An EventEmitter instance used to emit signals when properties change.
     * Specifically used to handle the 'PropertiesChanged' signal.
     */
    protected readonly eventEmitter: EventEmitter = new EventEmitter()

    /**
     * Constructor for the PropertiesInterface.
     * Initializes the interface with the name 'org.freedesktop.DBus.Properties'
     * and defines methods for getting and setting properties, as well as a signal
     * for notifying about property changes.
     */
    constructor() {
        super('org.freedesktop.DBus.Properties')
        this
            .defineMethod({
                name: 'Get',
                inputArgs: [
                    {
                        name: 'interface_name',
                        type: 's' // String type for interface name
                    },
                    {
                        name: 'property_name',
                        type: 's' // String type for property name
                    }
                ],
                outputArgs: [
                    {
                        name: 'value',
                        type: 'v' // Variant type for property value
                    }
                ],
                method: async (interfaceName: string, propertyName: string): Promise<any> => this.get(interfaceName, propertyName)
                // Retrieves the value of a specific property from the specified interface.
            })
            .defineMethod({
                name: 'GetAll',
                inputArgs: [{
                    name: 'interface_name',
                    type: 's' // String type for interface name
                }],
                outputArgs: [{
                    name: 'properties',
                    type: 'a{sv}' // Array of dictionary entries (string key, variant value) for properties
                }],
                method: async (interfaceName: string): Promise<Record<string, any>> => this.getAll(interfaceName)
                // Retrieves all properties of the specified interface as a key-value map.
            })
            .defineMethod({
                name: 'Set',
                inputArgs: [
                    {
                        name: 'interface_name',
                        type: 's' // String type for interface name
                    },
                    {
                        name: 'property_name',
                        type: 's' // String type for property name
                    },
                    {
                        name: 'value',
                        type: 'v' // Variant type for property value
                    }
                ],
                method: async (interfaceName: string, propertyName: string, value: any): Promise<void> => this.set(interfaceName, propertyName, value)
                // Sets the value of a specific property on the specified interface.
            })
            .defineSignal({
                name: 'PropertiesChanged',
                args: [
                    {name: 'interface_name', type: 's'},             // String type for interface name
                    {name: 'changed_properties', type: 'a{sv}'},     // Array of dictionary entries for changed properties
                    {name: 'invalidated_properties', type: 'as'}      // Array of strings for invalidated property names
                ],
                eventEmitter: this.eventEmitter
                // Signal emitted when properties are changed or invalidated.
            })
    }

    /**
     * Retrieves the value of a specific property from the specified interface.
     * Throws a DBus error if the interface is not found.
     *
     * @param interfaceName - The name of the interface containing the property.
     * @param propertyName - The name of the property to retrieve.
     * @returns A Promise resolving to the value of the property.
     * @throws {Error} DBus error if the interface is not found.
     */
    protected async get(interfaceName: string, propertyName: string): Promise<any> {
        const targetInterface: LocalInterface | undefined = this.object?.findInterfaceByName(interfaceName)
        if (!targetInterface) throw CreateDBusError('org.freedesktop.DBus.Error.UnknownInterface', `Interface ${interfaceName} not found`)
        return await targetInterface.getProperty(propertyName)
    }

    /**
     * Sets the value of a specific property on the specified interface.
     * Throws a DBus error if the interface is not found.
     *
     * @param interfaceName - The name of the interface containing the property.
     * @param propertyName - The name of the property to set.
     * @param value - The value to set for the property.
     * @returns A Promise that resolves when the property is set.
     * @throws {Error} DBus error if the interface is not found.
     */
    protected async set(interfaceName: string, propertyName: string, value: any): Promise<void> {
        const targetInterface: LocalInterface | undefined = this.object?.findInterfaceByName(interfaceName)
        if (!targetInterface) throw CreateDBusError('org.freedesktop.DBus.Error.UnknownInterface', `Interface ${interfaceName} not found`)
        await targetInterface.setProperty(propertyName, value)
    }

    /**
     * Retrieves all properties of the specified interface as a key-value map.
     * Returns an empty object if the interface is not found.
     *
     * @param interfaceName - The name of the interface to retrieve properties from.
     * @returns A Promise resolving to a record (object) of property names and their values.
     */
    protected async getAll(interfaceName: string): Promise<Record<string, any>> {
        const targetInterface: LocalInterface | undefined = this.object?.findInterfaceByName(interfaceName)
        if (!targetInterface) return {}
        const rawValues: Record<string, any>[] = await Promise.all(targetInterface.propertyNames().map((propertyName: string): Promise<Record<string, any>> => {
            return new Promise(async (resolve, reject) => {
                try {
                    const resultObject: Record<string, any> = {}
                    resultObject[propertyName] = await this.get(interfaceName, propertyName)
                    return resolve(resultObject)
                } catch (e) {
                    return reject(e)
                }
            })
        }))
        let result: Record<string, any> = {}
        rawValues.forEach((rawValue: Record<string, any>): Record<string, any> => result = Object.assign(result, rawValue))
        return result
    }

    /**
     * Emits the 'PropertiesChanged' signal to notify listeners of property updates.
     * Used to inform clients about changes to properties or invalidation of property values.
     *
     * @param interfaceName - The name of the interface whose properties have changed.
     * @param changedProperties - A record of property names and their new values.
     * @param invalidatedProperties - An optional array of property names that are no longer valid.
     */
    public emitPropertiesChanged(interfaceName: string, changedProperties: Record<string, any>, invalidatedProperties: string[] = []): void {
        this.eventEmitter.emit('PropertiesChanged', interfaceName, changedProperties, invalidatedProperties)
    }
}
