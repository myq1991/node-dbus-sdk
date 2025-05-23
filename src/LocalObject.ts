import {LocalInterface} from './LocalInterface'
import {LocalInterfaceExistsError, LocalObjectInvalidNameError} from './lib/Errors'
import {DBus} from './DBus'
import {LocalService} from './LocalService'
import {IntrospectNode} from './types/IntrospectNode'
import {IntrospectInterface} from './types/IntrospectInterface'
import {IntrospectableInterface} from './lib/common/IntrospectableInterface'
import {PropertiesInterface} from './lib/common/PropertiesInterface'
import {PeerInterface} from './lib/common/PeerInterface'

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

    public get propertiesInterface(): PropertiesInterface {
        return this.findInterfaceByName<PropertiesInterface>('org.freedesktop.DBus.Properties')!
    }

    public get introspectableInterface(): IntrospectableInterface {
        return this.findInterfaceByName<IntrospectableInterface>('org.freedesktop.DBus.Introspectable')!
    }

    public get peerInterface(): PeerInterface {
        return this.findInterfaceByName<PeerInterface>('org.freedesktop.DBus.Peer')!
    }

    constructor(objectPath: string) {
        this.#name = this.validateDBusObjectPath(objectPath)
        this.addInterface(new PropertiesInterface())
        this.addInterface(new IntrospectableInterface())
        this.addInterface(new PeerInterface())
    }

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

    public findInterfaceByName<T extends LocalInterface = LocalInterface>(name: string): T | undefined {
        return this.#interfaceMap.get(name) as T
    }
}