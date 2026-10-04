import {DBusServiceOpts} from './types/DBusServiceOpts'
import {DBusObject} from './DBusObject'
import {DBus} from './DBus'
import {parseStringPromise as parseXMLString} from 'xml2js'
import {DBusTypeClass} from './lib/DBusTypeClass'

/**
 * A proxy for a service on the bus, by its well-known name (e.g. 'org.freedesktop.NetworkManager').
 * Get one from DBus.getService; it follows the name to its current owner when the service restarts.
 *
 * @example
 * const service = await dbus.getService('org.freedesktop.DBus')
 * console.log(await service.listObjectPaths())   // ['/', '/org/freedesktop/DBus']
 * const object = await service.getObject('/org/freedesktop/DBus')
 */
export class DBusService {

    #uniqueName: string

    protected readonly opts: DBusServiceOpts

    protected readonly dbus: DBus

    /**
     * The service's name as requested, e.g. 'org.freedesktop.NetworkManager'.
     */
    public readonly name: string

    /**
     * The unique name of the connection that currently owns the name, e.g. ':1.42'; updated when the owner changes.
     */
    public get uniqueName(): string {
        return this.#uniqueName
    }

    /**
     * Created by DBus.getService; not meant to be constructed directly.
     *
     * @param opts - The connection, the service name and its current owner.
     */
    constructor(opts: DBusServiceOpts) {
        this.opts = opts
        this.dbus = opts.dbus
        this.name = opts.service
        this.#uniqueName = opts.uniqueName
    }

    /**
     * Records the new owner of the name; called by DBus when the name changes owner.
     *
     * @param uniqueName - The new owner's unique name, or '' when the name has no owner.
     */
    protected updateUniqueName(uniqueName: string): void {
        this.#uniqueName = uniqueName
    }

    /**
     * Lists the paths of the service's objects by introspecting its tree from '/'. Paths that are only intermediate
     * nodes without interfaces (e.g. '/org' above '/org/example/Object') are left out; subtrees that fail to
     * introspect are skipped.
     *
     * @returns The object paths, e.g. ['/', '/org/example/Object'].
     */
    public async listObjectPaths(): Promise<string[]> {
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
            const parsedObject: any = await parseXMLString(xmlResponse instanceof DBusTypeClass ? xmlResponse.value : xmlResponse)
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
        if (!allObjectPaths.includes('/')) allObjectPaths.push('/') // the root is always listed unless it is empty
        return allObjectPaths.concat(emptyObjectPaths).filter(v => !allObjectPaths.includes(v) || !emptyObjectPaths.includes(v))
    }

    /**
     * Proxies for all objects listed by listObjectPaths.
     *
     * @returns One DBusObject per object path.
     */
    public async getObjects(): Promise<DBusObject[]> {
        const objectPaths: string[] = await this.listObjectPaths()
        return Promise.all(objectPaths.map((objectPath: string): Promise<DBusObject> => this.getObject(objectPath)))
    }

    /**
     * A proxy for the object at a path. Nothing is checked or sent until the object is used: a path without an
     * object gives an object without interfaces.
     *
     * @param objectPath - The object path, e.g. '/org/freedesktop/DBus'.
     * @returns The object proxy.
     */
    public async getObject(objectPath: string): Promise<DBusObject> {
        return new DBusObject({
            ...this.opts,
            objectPath: objectPath,
            dbusService: this
        })
    }
}