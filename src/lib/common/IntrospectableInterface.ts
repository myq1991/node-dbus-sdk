import {LocalInterface} from '../../LocalInterface'
import {Builder} from 'xml2js'
import {LocalObject} from '../../LocalObject'
import {IntrospectInterface} from '../../types/IntrospectInterface'
import {IntrospectMethod} from '../../types/IntrospectMethod'
import {IntrospectProperty} from '../../types/IntrospectProperty'
import {IntrospectSignal} from '../../types/IntrospectSignal'
import {IntrospectMethodArgument} from '../../types/IntrospectMethodArgument'
import {IntrospectSignalArgument} from '../../types/IntrospectSignalArgument'

export class IntrospectableInterface extends LocalInterface {

    readonly #doctype: string = '!DOCTYPE'

    readonly #header: string = `<${this.#doctype} node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN"
                      "http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd">`

    constructor() {
        super('org.freedesktop.DBus.Introspectable')
        this.defineMethod({
            name: 'Introspect',
            outputArgs: [{
                name: 'xml_data',
                type: 's'
            }],
            method: (): string => this.getIntrospectXML(this.object?.name)
        })
    }

    public getIntrospectXML(path?: string, inputObjectPaths?: string[]): string {
        return `${this.#header}\n${this.formatIntrospectXML(path, inputObjectPaths)}`
    }

    public formatIntrospectXML(path?: string, inputObjectPaths?: string[]): string {
        const builder: Builder = new Builder({
            rootName: 'node',
            headless: true
        })
        if (!path) return builder.buildObject({})
        const objectPaths: string[] | undefined = inputObjectPaths ? inputObjectPaths : this.object?.service?.listObjectPaths()
        if (!objectPaths) return builder.buildObject({})
        const roughlyMatchedObjectPaths: string[] = objectPaths.filter((objectPath: string): boolean => objectPath.startsWith(path))
        const matchedObjectPath: string | undefined = roughlyMatchedObjectPaths.find((roughlyMatchedObjectPath: string): boolean => roughlyMatchedObjectPath === path)
        const xmlObject: Record<string, any> = {}
        if (matchedObjectPath) {
            const localObject: LocalObject = this.object!.service!.findObjectByPath(matchedObjectPath)!
            const interfaces = localObject.introspectNode.interface.map((introspectableInterface: IntrospectInterface) => {
                const methods = introspectableInterface.method.map((introspectMethod: IntrospectMethod) => {
                    const args = introspectMethod.arg.map((introspectMethodArgument: IntrospectMethodArgument) => {
                        const xmlMethodArgObject: Record<string, any> = {
                            direction: introspectMethodArgument.direction,
                            type: introspectMethodArgument.type
                        }
                        if (introspectMethodArgument.name) xmlMethodArgObject.name = introspectMethodArgument.name
                        return {
                            $: xmlMethodArgObject
                        }
                    })
                    const xmlMethodObject: Record<string, any> = {
                        $: {name: introspectMethod.name}
                    }
                    if (args.length) xmlMethodObject.arg = args
                    return xmlMethodObject
                })
                const properties = introspectableInterface.property.map((introspectProperty: IntrospectProperty) => {
                    const xmlPropertyObject: Record<string, any> = {
                        $: {
                            name: introspectProperty.name,
                            type: introspectProperty.type,
                            access: introspectProperty.access
                        }
                    }
                    return xmlPropertyObject
                })
                const signals = introspectableInterface.signal.map((introspectSignal: IntrospectSignal) => {
                    const args = introspectSignal.arg.map((introspectSignalArgument: IntrospectSignalArgument) => {
                        const xmlSignalArgObject: Record<string, any> = {
                            type: introspectSignalArgument.type
                        }
                        if (introspectSignalArgument.name) xmlSignalArgObject.name = introspectSignalArgument.name
                        return {
                            $: introspectSignalArgument
                        }
                    })
                    const xmlSignalObject: Record<string, any> = {
                        $: {name: introspectSignal.name}
                    }
                    if (args.length) xmlSignalObject.arg = args
                    return xmlSignalObject
                })
                const xmlInterfaceObject: Record<string, any> = {
                    $: {name: introspectableInterface.name}
                }
                if (methods.length) xmlInterfaceObject.method = methods
                if (properties.length) xmlInterfaceObject.property = properties
                if (signals.length) xmlInterfaceObject.signal = signals
                return xmlInterfaceObject
            })
            if (interfaces.length) xmlObject.interface = interfaces
        }
        const nodes = roughlyMatchedObjectPaths.map((roughlyMatchedObjectPath: string): string => {
            const subNode: string | undefined = roughlyMatchedObjectPath.replace(path, '').split('/').find((objectNode: string): boolean => !!objectNode)
            return subNode ? subNode : ''
        }).filter((subNode: string): boolean => !!subNode)
            .map(nodeName => ({$: {name: nodeName}}))
        if (nodes.length) xmlObject.node = nodes
        return builder.buildObject(xmlObject)
    }
}