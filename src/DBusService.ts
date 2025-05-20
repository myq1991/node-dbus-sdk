import {DBusServiceOpts} from './types/DBusServiceOpts'
import {DBusObject} from './DBusObject'
import {DBus} from './DBus'
import {parseStringPromise as parseXMLString} from 'xml2js'

export class DBusService {

    #uniqueName: string

    protected readonly opts: DBusServiceOpts

    protected readonly dbus: DBus

    public readonly name: string

    public get uniqueName(): string {
        return this.#uniqueName
    }

    constructor(opts: DBusServiceOpts) {
        this.opts = opts
        this.dbus = opts.dbus
        this.name = opts.service
        this.#uniqueName = opts.uniqueName
    }

    /**
     * Update unique name
     * @param uniqueName
     * @protected
     */
    protected updateUniqueName(uniqueName: string): void {
        this.#uniqueName = uniqueName
    }

    /**
     * List all object paths
     */
    public async listObjects(): Promise<string[]> {
        if (!this.name) return []
        const emptyObjectPaths: string[] = []
        const getSubNodes: (objectPath?: string) => Promise<string[]> = async (objectPath: string = '/'): Promise<string[]> => {
            const objectPaths: string[] = objectPath === '/' ? ['/'] : []
            const [xmlResponse] = await this.dbus.invoke({
                service: this.name,
                objectPath: objectPath,
                interface: 'org.freedesktop.DBus.Introspectable',
                method: 'Introspect'
            })
            if (!xmlResponse) return []
            const parsedObject: any = await parseXMLString(xmlResponse)
            if (!parsedObject?.node?.interface) emptyObjectPaths.push(objectPath)
            if (!parsedObject?.node?.node) return []
            const nodeNames: string[] = (parsedObject.node.node as { $: { name: string } }[]).map((node: {
                $: { name: string }
            }): string => node.$.name)
            const promises: Promise<string[]>[] = []
            nodeNames.forEach((nodeName: string): void => {
                const fullObjectPath: string = `${objectPath === '/' ? '' : objectPath}/${nodeName}`
                objectPaths.push(fullObjectPath)
                promises.push(new Promise(resolve => getSubNodes(`${objectPath === '/' ? '' : objectPath}/${nodeName}`).then(resolve).catch((): void => resolve([]))))
            })
            const result: string[][] = await Promise.all(promises)
            result.forEach((item: string[]): void => item.forEach((value: string): number => objectPaths.push(value)))
            return objectPaths
        }
        const allObjectPaths: string[] = [...new Set(await getSubNodes())]
        if (!allObjectPaths.includes('/')) allObjectPaths.push('/')//将根路径加入列表
        return allObjectPaths.concat(emptyObjectPaths).filter(v => !allObjectPaths.includes(v) || !emptyObjectPaths.includes(v))
    }

    /**
     * Get all objects from dbus service
     */
    public async getObjects(): Promise<DBusObject[]> {
        const objectPaths: string[] = await this.listObjects()
        return Promise.all(objectPaths.map((objectPath: string): Promise<DBusObject> => this.getObject(objectPath)))
    }

    /**
     * Get object from dbus service
     * @param objectPath
     */
    public async getObject(objectPath: string): Promise<DBusObject> {
        return new DBusObject({
            ...this.opts,
            objectPath: objectPath,
            dbusService: this
        })
    }
}