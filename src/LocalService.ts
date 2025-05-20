import {LocalObject} from './LocalObject'
import {ConnectOpts} from './types/ConnectOpts'
import {DBus} from './DBus'
import {DBusMessage} from './lib/DBusMessage'
import {LocalObjectPathExistsError} from './lib/Errors'

export class LocalService {

    readonly #name: string

    readonly #objectMap: Map<string, LocalObject> = new Map()

    readonly #emptyObjectMap: Map<string, LocalObject> = new Map()

    public dbus: DBus

    public get name(): string {
        return this.#name
    }

    constructor(serviceName: string) {
        this.#name = serviceName
    }

    #methodCallHandler: (message: DBusMessage) => Promise<void> = async (message: DBusMessage): Promise<void> => {
        console.log('!!!!!')
        const targetPath: string = message.header.path
        const targetInterface: string = message.header.interfaceName
        // const registeredObjectPaths: string[] = [...this.#objectMap.keys()]
        // const startWithTargetPaths: string[] = registeredObjectPaths.filter((registeredObjectPath: string): boolean => registeredObjectPath.startsWith(targetPath))
        // if (!startWithTargetPaths.length) return
    }

    public async run(opts: ConnectOpts): Promise<void> {
        this.dbus = await DBus.connect(opts)
        this.dbus.on('methodCall', this.#methodCallHandler)
        await this.dbus.requestName(this.#name)
    }

    public async stop(): Promise<void> {
        await this.dbus.releaseName(this.#name)
        this.dbus.off('methodCall', this.#methodCallHandler)
        await this.dbus.disconnect()
    }

    public addObject(localObject: LocalObject) {
        if (this.#objectMap.has(localObject.name)) {
            if (this.#objectMap.get(localObject.name) !== localObject) {
                throw new LocalObjectPathExistsError(`Local object path ${localObject.name} exists`)
            } else {
                return
            }
        }
        localObject.setService(this)
        this.#objectMap.set(localObject.name, localObject)
    }

    public removeObject(localObject: LocalObject): boolean
    public removeObject(localObjectPath: string): boolean
    public removeObject(inp: LocalObject | string): boolean {
        let removeSuccess: boolean
        if (typeof inp === 'string') {
            this.#objectMap.get(inp)?.setService(undefined)
            removeSuccess = this.#objectMap.delete(inp)
        } else {
            const result: [string, LocalObject] | undefined = [...this.#objectMap.entries()].find(([localObjectPath, localObject]): boolean => localObject === inp)
            if (!result) {
                removeSuccess = false
            } else {
                result[1].setService(undefined)
                removeSuccess = this.#objectMap.delete(result[0])
            }
        }
        return removeSuccess
    }

    public listObjects(): Record<string, LocalObject> {
        const objects: Record<string, LocalObject> = {}
        this.#objectMap.forEach((localObject: LocalObject, objectPath: string): LocalObject => objects[objectPath] = localObject)
        return objects
    }
}