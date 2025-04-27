import {MessageBus} from './MessageBus'
import {messageType} from './lib/Constants'
import {parseStringPromise as parseXMLString} from 'xml2js'
import {As, uniqueArray} from './lib/Helpers'

export class DBusService {
    public readonly name: string

    public readonly bus: MessageBus

    constructor(service: string, bus: MessageBus) {
        this.name = service
        this.bus = bus
    }

    public async init(): Promise<this> {
        await this.getServiceObjectPaths()
        return this
    }

    protected async getServiceObjectPaths(): Promise<string[]> {
        if (!this.name) return []
        const emptyObjectPaths: string[] = []
        const getSubNodes: (objectPath?: string) => Promise<string[]> = async (objectPath: string = '/'): Promise<string[]> => {
            const objectPaths: string[] = objectPath === '/' ? ['/'] : []
            let xmlResponse: string
            [xmlResponse] = await this.bus.invoke({
                type: messageType.methodCall,
                member: 'Introspect',
                path: objectPath,
                destination: this.name,
                interface: 'org.freedesktop.DBus.Introspectable'
            })
            if (!xmlResponse) return []
            const parsedObject = await parseXMLString(xmlResponse)
            if (!parsedObject?.node?.interface) emptyObjectPaths.push(objectPath)
            if (!parsedObject?.node?.node) return []
            const nodeNames: string[] = As<{ $: { name: string } }[]>(parsedObject.node.node).map((node: {
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
        const allObjectPaths: string[] = uniqueArray(await getSubNodes())
        if (!allObjectPaths.includes('/')) allObjectPaths.push('/')//将根路径加入列表
        return allObjectPaths.concat(emptyObjectPaths).filter(v => !allObjectPaths.includes(v) || !emptyObjectPaths.includes(v))
    }
}