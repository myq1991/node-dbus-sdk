import {LocalInterface} from '../../LocalInterface'
import EventEmitter from 'node:events'
import {LocalObject} from '../../LocalObject'

export class ObjectManagerInterface extends LocalInterface {

    #eventEmitter: EventEmitter = new EventEmitter()

    constructor() {
        super('org.freedesktop.DBus.ObjectManager')
        this.defineMethod({
            name: 'GetManagedObjects',
            outputArgs: [{
                type: 'a{oa{sa{sv}}}'
            }],
            method: async (): Promise<Record<string, Record<string, Record<string, any>>>> => this.getManagedObjects()
        })
            .defineSignal({
                name: 'InterfacesAdded',
                args: [
                    // {
                    //     name: 'object_path',
                    //     type: 'o'
                    // },
                    {
                        name: 'interfaces_and_properties',
                        type: 'a{sa{sv}}'
                    }
                ],
                eventEmitter: this.#eventEmitter
            })
            .defineSignal({
                name: 'InterfacesRemoved',
                args: [
                    {
                        name: 'object_path',
                        type: 'o'
                    },
                    {
                        name: 'interfaces',
                        type: 'as'
                    }
                ],
                eventEmitter: this.#eventEmitter
            })
    }

    protected async getManagedObjects(): Promise<Record<string, Record<string, Record<string, any>>>> {
        const managedObjects: Record<string, Record<string, Record<string, any>>> = {}
        const objects: Record<string, LocalObject> | undefined = this.object?.service?.listObjects()
        if (!objects) return managedObjects
        for (const objectPath in objects) {
            const object: LocalObject = objects[objectPath]
            managedObjects[objectPath] = await object.getManagedInterfaces()
        }
        return managedObjects
    }

    public interfacesAdded(localObject: LocalObject, interfacesAndProperties: Record<string, Record<string, any>>): void {
        // this.#eventEmitter.emit('InterfacesAdded', localObject.name, interfacesAndProperties)
        this.#eventEmitter.emit('InterfacesAdded', localObject.name, {})//TODO 发出去的信号解析有问题
        // this.#eventEmitter.emit('InterfacesAdded',  interfacesAndProperties)
    }

    public interfacesRemoved(localObject: LocalObject, interfaces: string[]): void {
        this.#eventEmitter.emit('InterfacesRemoved', localObject.name, interfaces)
    }
}