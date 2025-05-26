import {DBusObjectOpts} from './types/DBusObjectOpts'
import {DBusInterface} from './DBusInterface'
import {DBus} from './DBus'
import {DBusService} from './DBusService'
import {parseStringPromise as parseXMLString} from 'xml2js'
import {IntrospectNode} from './types/IntrospectNode'
import {IntrospectInterface} from './types/IntrospectInterface'
import {IntrospectMethod} from './types/IntrospectMethod'
import {IntrospectProperty} from './types/IntrospectProperty'
import {IntrospectSignal} from './types/IntrospectSignal'
import {IntrospectMethodArgument} from './types/IntrospectMethodArgument'
import {IntrospectSignalArgument} from './types/IntrospectSignalArgument'
import {InterfaceNotFoundError} from './lib/Errors'
import {DBusTypeClass} from './lib/DBusTypeClass'

export class DBusObject {

    protected readonly opts: DBusObjectOpts

    protected readonly dbus: DBus

    protected readonly service: DBusService

    public readonly name: string

    #shareIntrospect: boolean = false

    #shareIntrospectInterfaces: IntrospectInterface[] = []

    /**
     * Constructor for DBusObject.
     * Initializes the DBus object with the provided options and sets up references to the DBus connection
     * and service.
     * @param opts - Configuration options for the DBus object.
     */
    constructor(opts: DBusObjectOpts) {
        this.opts = opts
        this.dbus = this.opts.dbus
        this.service = this.opts.dbusService
        this.name = this.opts.objectPath
    }

    /**
     * Internal method to get a DBus interface by name.
     * Retrieves or caches introspection data for the specified interface and creates a DBusInterface instance.
     * @param iface - The name of the interface to retrieve.
     * @param shareIntrospect - Whether to use shared introspection data to avoid multiple introspections.
     * @returns A Promise resolving to a DBusInterface instance for the specified interface.
     * @throws InterfaceNotFoundError if the specified interface is not found.
     */
    protected async internalGetInterface(iface: string, shareIntrospect: boolean = false): Promise<DBusInterface> {
        let introspectInterfaces: IntrospectInterface[]
        if (shareIntrospect) {
            introspectInterfaces = this.#shareIntrospectInterfaces
        } else {
            introspectInterfaces = (await this.introspect()).interface
        }
        const introspectInterface: IntrospectInterface | undefined = introspectInterfaces.find((introspectInterface: IntrospectInterface): boolean => introspectInterface.name === iface)
        if (!introspectInterface) throw new InterfaceNotFoundError(`Interface ${iface} not found`)
        return new DBusInterface({
            ...this.opts,
            iface: iface,
            dbusObject: this,
            introspectInterface: introspectInterface
        })
    }

    /**
     * Introspects the DBus object to retrieve its structure and metadata.
     * Invokes the Introspect method on the DBus object to get XML data, parses it, and constructs
     * an IntrospectNode object with details about interfaces, methods, properties, and signals.
     * @returns A Promise resolving to an IntrospectNode object representing the object's introspection data.
     */
    public async introspect(): Promise<IntrospectNode> {
        const [introspectXML] = await this.dbus.invoke({
            service: this.service.name,
            objectPath: this.name,
            interface: 'org.freedesktop.DBus.Introspectable',
            method: 'Introspect'
        })
        const introspectObject: any = await parseXMLString(introspectXML instanceof DBusTypeClass ? introspectXML.value : introspectXML)
        const node: any = introspectObject.node
        const interfaces: any[] = node.interface ? node.interface : []
        return {
            interface: interfaces.map(interfaceInfo => {
                const method: any[] = interfaceInfo.method ? interfaceInfo.method : []
                const property: any[] = interfaceInfo.property ? interfaceInfo.property : []
                const signal: any[] = interfaceInfo.signal ? interfaceInfo.signal : []
                const introspectInterface: IntrospectInterface = {
                    name: interfaceInfo.$.name,
                    method: method.map(methodInfo => {
                        const arg: any[] = methodInfo.arg ? methodInfo.arg : []
                        const introspectMethod: IntrospectMethod = {
                            name: methodInfo.$.name,
                            arg: arg.map(methodArgInfo => {
                                const introspectMethodArgument: IntrospectMethodArgument = {
                                    name: methodArgInfo.$.name,
                                    type: methodArgInfo.$.type,
                                    direction: methodArgInfo.$.direction
                                }
                                return introspectMethodArgument
                            })
                        }
                        return introspectMethod
                    }),
                    property: property.map(propertyInfo => {
                        const introspectProperty: IntrospectProperty = {
                            name: propertyInfo.$.name,
                            type: propertyInfo.$.type,
                            access: propertyInfo.$.access
                        }
                        return introspectProperty
                    }),
                    signal: signal.map(signalInfo => {
                        const arg: any[] = signalInfo.arg ? signalInfo.arg : []
                        const introspectSignal: IntrospectSignal = {
                            name: signalInfo.$.name,
                            arg: arg.map(signalArgInfo => {
                                const introspectSignalArgument: IntrospectSignalArgument = {
                                    name: signalArgInfo.$.name,
                                    type: signalArgInfo.$.type
                                }
                                return introspectSignalArgument
                            })
                        }
                        return introspectSignal
                    })
                }
                return introspectInterface
            })
        }
    }

    /**
     * Lists all interface names available on this DBus object.
     * Performs introspection to retrieve the list of interfaces and optionally caches the result.
     * @returns A Promise resolving to an array of interface names as strings.
     */
    public async listInterfaces(): Promise<string[]> {
        const introspectResult: IntrospectNode = await this.introspect()
        if (this.#shareIntrospect) this.#shareIntrospectInterfaces = introspectResult.interface
        return introspectResult.interface.map((iface: IntrospectInterface): string => iface.name)
    }

    /**
     * Retrieves all DBus interfaces available on this object.
     * Uses shared introspection data to efficiently create DBusInterface instances for all interfaces.
     * @returns A Promise resolving to an array of DBusInterface instances for all interfaces on this object.
     */
    public async getInterfaces(): Promise<DBusInterface[]> {
        this.#shareIntrospect = true
        const interfaceNames: string[] = await this.listInterfaces()
        const dbusInterfaces: DBusInterface[] = await Promise.all(interfaceNames.map((interfaceName: string): Promise<DBusInterface> => this.internalGetInterface(interfaceName, true)))
        this.#shareIntrospectInterfaces = []
        this.#shareIntrospect = false
        return dbusInterfaces
    }

    /**
     * Retrieves a specific DBus interface by name from this object.
     * @param iface - The name of the interface to retrieve.
     * @returns A Promise resolving to a DBusInterface instance for the specified interface.
     * @throws InterfaceNotFoundError if the specified interface is not found.
     */
    public async getInterface(iface: string): Promise<DBusInterface> {
        return await this.internalGetInterface(iface, false)
    }
}
