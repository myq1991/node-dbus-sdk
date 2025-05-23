import {LocalInterface} from './LocalInterface'
import {LocalInterfaceExistsError} from './lib/Errors'
import {DBus} from './DBus'
import {LocalService} from './LocalService'
import {IntrospectNode} from './types/IntrospectNode'
import {IntrospectInterface} from './types/IntrospectInterface'
import {IntrospectableInterface} from './lib/IntrospectableInterface'
import {PropertiesInterface} from './lib/PropertiesInterface'

export class LocalObject {

    readonly #name: string

    #interfaceMap: Map<string, LocalInterface> = new Map()

    public service: LocalService | undefined

    public get dbus(): DBus | undefined {
        if (!this.service) return
        return this.service.dbus
    }

    public get name(): string {
        return this.#name
    }

    constructor(objectPath: string) {
        this.#name = objectPath
        this.addInterface(new PropertiesInterface())
        this.addInterface(new IntrospectableInterface())
    }

    public setService(service: LocalService | undefined): this {
        this.service = service
        return this
    }

    public get introspectNode(): IntrospectNode {
        const interfaces: IntrospectInterface[] = []
        this.#interfaceMap.forEach((localInterface: LocalInterface): void => {
            interfaces.push(localInterface.introspectInterface)
        })
        return {
            interface: interfaces
        }
    }

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
        return addSuccess
    }

    public removeInterface(interfaceName: string): boolean
    public removeInterface(localInterface: LocalInterface): boolean
    public removeInterface(inp: LocalInterface | string): boolean {
        let removeSuccess: boolean
        if (typeof inp === 'string') {
            this.#interfaceMap.get(inp)?.setObject(undefined)
            removeSuccess = this.#interfaceMap.delete(inp)
        } else {
            const result: [string, LocalInterface] | undefined = [...this.#interfaceMap.entries()].find(([interfaceName, localInterface]): boolean => localInterface === inp)
            if (!result) {
                removeSuccess = false
            } else {
                result[1].setObject(undefined)
                removeSuccess = this.#interfaceMap.delete(result[0])
            }
        }
        return removeSuccess
    }

    public listInterfaces(): Record<string, LocalInterface> {
        const interfaces: Record<string, LocalInterface> = {}
        this.#interfaceMap.forEach((localInterface: LocalInterface, interfaceName: string): LocalInterface => interfaces[interfaceName] = localInterface)
        return interfaces
    }

    public findInterfaceByName(name: string): LocalInterface | undefined {
        return this.#interfaceMap.get(name)
    }
}