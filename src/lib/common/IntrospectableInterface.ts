import {LocalInterface} from '../../LocalInterface'
import {Builder} from 'xml2js'
import {LocalObject} from '../../LocalObject'
import {IntrospectInterface} from '../../types/IntrospectInterface'
import {IntrospectMethod} from '../../types/IntrospectMethod'
import {IntrospectProperty} from '../../types/IntrospectProperty'
import {IntrospectSignal} from '../../types/IntrospectSignal'
import {IntrospectMethodArgument} from '../../types/IntrospectMethodArgument'
import {IntrospectSignalArgument} from '../../types/IntrospectSignalArgument'

/**
 * A class representing the DBus Introspectable interface.
 * This interface provides introspection capabilities for DBus objects, allowing clients to query
 * the structure (methods, properties, signals) of a DBus object as XML data.
 * Implements the 'org.freedesktop.DBus.Introspectable' interface.
 */
export class IntrospectableInterface extends LocalInterface {

    /**
     * The DOCTYPE declaration prefix used in the introspection XML.
     * Used to construct the XML header for introspection data.
     */
    readonly #doctype: string = '!DOCTYPE'

    /**
     * The full DOCTYPE header for the introspection XML.
     * Defines the DTD for DBus object introspection as per the freedesktop.org specification.
     */
    readonly #header: string = `<${this.#doctype} node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN"
                      "http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd">`

    /**
     * Constructor for the IntrospectableInterface.
     * Initializes the interface with the name 'org.freedesktop.DBus.Introspectable'
     * and defines the 'Introspect' method to return XML introspection data.
     */
    constructor() {
        super('org.freedesktop.DBus.Introspectable')
        this.defineMethod({
            name: 'Introspect',
            outputArgs: [{
                name: 'xml_data',
                type: 's' // String type for XML data
            }],
            method: (): string => this.getIntrospectXML(this.object?.name)
        })
    }

    /**
     * Generates the full introspection XML for a given object path.
     * Combines the DOCTYPE header with the formatted XML content for the specified path.
     *
     * @param path - Optional object path to generate introspection XML for.
     * @param inputObjectPaths - Optional list of object paths to consider for introspection.
     * @returns The complete introspection XML string, including the DOCTYPE header.
     */
    public getIntrospectXML(path?: string, inputObjectPaths?: string[]): string {
        return `${this.#header}\n${this.formatIntrospectXML(path, inputObjectPaths)}`
    }

    /**
     * Formats the introspection data into XML for a given object path.
     * Builds an XML representation of the DBus object's structure, including interfaces,
     * methods, properties, signals, and sub-nodes, using the xml2js Builder.
     *
     * @param path - Optional object path to format introspection XML for.
     * @param inputObjectPaths - Optional list of object paths to consider for introspection.
     * @returns The formatted introspection XML string (without DOCTYPE header).
     */
    public formatIntrospectXML(path?: string, inputObjectPaths?: string[]): string {
        const builder: Builder = new Builder({
            rootName: 'node', // Root element of the introspection XML
            headless: true    // Exclude XML declaration (<?xml ... ?>)
        })
        if (!path) return builder.buildObject({}) // Return empty XML if no path is provided
        const objectPaths: string[] | undefined = inputObjectPaths ? inputObjectPaths : this.object?.service?.listObjectPaths()
        if (!objectPaths) return builder.buildObject({}) // Return empty XML if no object paths are available

        // Filter object paths that start with the given path to find relevant nodes
        const roughlyMatchedObjectPaths: string[] = objectPaths.filter((objectPath: string): boolean => objectPath.startsWith(path))
        const matchedObjectPath: string | undefined = roughlyMatchedObjectPaths.find((roughlyMatchedObjectPath: string): boolean => roughlyMatchedObjectPath === path)
        const xmlObject: Record<string, any> = {}

        // If an exact match for the path is found, include interface details
        if (matchedObjectPath) {
            const localObject: LocalObject = this.object!.service!.findObjectByPath(matchedObjectPath)!
            const interfaces = localObject.introspectNode.interface.map((introspectableInterface: IntrospectInterface) => {
                // Map methods of the interface to XML structure
                const methods = introspectableInterface.method.map((introspectMethod: IntrospectMethod) => {
                    const args = introspectMethod.arg.map((introspectMethodArgument: IntrospectMethodArgument) => {
                        const xmlMethodArgObject: Record<string, any> = {
                            direction: introspectMethodArgument.direction, // 'in' or 'out'
                            type: introspectMethodArgument.type           // DBus type signature (e.g., 's', 'i')
                        }
                        if (introspectMethodArgument.name) xmlMethodArgObject.name = introspectMethodArgument.name
                        return {
                            $: xmlMethodArgObject // XML attributes for the argument
                        }
                    })
                    const xmlMethodObject: Record<string, any> = {
                        $: {name: introspectMethod.name} // XML attribute for method name
                    }
                    if (args.length) xmlMethodObject.arg = args // Include arguments if any
                    return xmlMethodObject
                })

                // Map properties of the interface to XML structure
                const properties = introspectableInterface.property.map((introspectProperty: IntrospectProperty) => {
                    const xmlPropertyObject: Record<string, any> = {
                        $: {
                            name: introspectProperty.name,   // Property name
                            type: introspectProperty.type,   // DBus type signature
                            access: introspectProperty.access // Access mode ('read', 'write', 'readwrite')
                        }
                    }
                    return xmlPropertyObject
                })

                // Map signals of the interface to XML structure
                const signals = introspectableInterface.signal.map((introspectSignal: IntrospectSignal) => {
                    const args = introspectSignal.arg.map((introspectSignalArgument: IntrospectSignalArgument) => {
                        const xmlSignalArgObject: Record<string, any> = {
                            type: introspectSignalArgument.type // DBus type signature
                        }
                        if (introspectSignalArgument.name) xmlSignalArgObject.name = introspectSignalArgument.name
                        return {
                            $: xmlSignalArgObject // XML attributes for the argument
                        }
                    })
                    const xmlSignalObject: Record<string, any> = {
                        $: {name: introspectSignal.name} // XML attribute for signal name
                    }
                    if (args.length) xmlSignalObject.arg = args // Include arguments if any
                    return xmlSignalObject
                })

                // Construct the interface XML object
                const xmlInterfaceObject: Record<string, any> = {
                    $: {name: introspectableInterface.name} // XML attribute for interface name
                }
                if (methods.length) xmlInterfaceObject.method = methods
                if (properties.length) xmlInterfaceObject.property = properties
                if (signals.length) xmlInterfaceObject.signal = signals
                return xmlInterfaceObject
            })
            if (interfaces.length) xmlObject.interface = interfaces // Include interfaces if any
        }

        // Extract sub-nodes (child object paths) under the current path for hierarchical representation
        const nodes = roughlyMatchedObjectPaths.map((roughlyMatchedObjectPath: string): string => {
            const subNode: string | undefined = roughlyMatchedObjectPath.replace(path, '').split('/').find((objectNode: string): boolean => !!objectNode)
            return subNode ? subNode : ''
        }).filter((subNode: string): boolean => !!subNode)
            .map(nodeName => ({$: {name: nodeName}})) // XML attribute for sub-node name
        if (nodes.length) xmlObject.node = nodes // Include sub-nodes if any

        return builder.buildObject(xmlObject) // Build and return the final XML string
    }
}
