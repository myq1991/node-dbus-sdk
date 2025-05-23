import {LocalInterface} from '../LocalInterface'
import EventEmitter from 'node:events'
import {CreateDBusError} from './CreateDBusError'

export class PropertiesInterface extends LocalInterface {
    constructor() {
        super('org.freedesktop.DBus.Properties')
        this
            .defineMethod({
                name: 'Get',
                inputArgs: [
                    {
                        name: 'interface_name',
                        type: 's'
                    },
                    {
                        name: 'property_name',
                        type: 's'
                    }
                ],
                outputArgs: [
                    {
                        name: 'value',
                        type: 'v'
                    }
                ],
                method: async (interfaceName: string, propertyName: string): Promise<any> => this.get(interfaceName, propertyName)
            })
            .defineMethod({
                name: 'GetAll',
                inputArgs: [{
                    name: 'interface_name',
                    type: 's'
                }],
                outputArgs: [{
                    name: 'properties',
                    type: 'a{sv}'
                }],
                method: async (interfaceName: string): Promise<Record<string, any>> => this.getAll(interfaceName)
            })
            .defineMethod({
                name: 'Set',
                inputArgs: [
                    {
                        name: 'interface_name',
                        type: 's'
                    },
                    {
                        name: 'property_name',
                        type: 's'
                    },
                    {
                        name: 'value',
                        type: 'v'
                    }
                ],
                method: async (interfaceName: string, propertyName: string, value: any): Promise<void> => this.set(interfaceName, propertyName, value)
            })
            .defineSignal({
                name: 'PropertiesChanged',
                args: [
                    {name: 'interface_name', type: 's'},
                    {name: 'changed_properties', type: 'a{sv}'},
                    {name: 'invalidated_properties', type: 'as'}
                ],
                eventEmitter: new EventEmitter()
            })
    }

    protected async get(interfaceName: string, propertyName: string): Promise<any> {
        const targetInterface: LocalInterface | undefined = this.object?.findInterfaceByName(interfaceName)
        if (!targetInterface) throw CreateDBusError('org.freedesktop.DBus.Error.UnknownInterface', `Interface ${interfaceName} not found`)
        return await targetInterface.getProperty(propertyName)
    }

    protected async set(interfaceName: string, propertyName: string, value: any): Promise<void> {
        const targetInterface: LocalInterface | undefined = this.object?.findInterfaceByName(interfaceName)
        if (!targetInterface) throw CreateDBusError('org.freedesktop.DBus.Error.UnknownInterface', `Interface ${interfaceName} not found`)
        await targetInterface.setProperty(propertyName, value)
    }

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
}