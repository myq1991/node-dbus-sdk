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

export class DBusObject {

    protected readonly opts: DBusObjectOpts

    protected readonly dbus: DBus

    protected readonly service: DBusService

    public readonly name: string

    #shareIntrospect: boolean = false

    #shareIntrospectInterfaces: IntrospectInterface[] = []

    constructor(opts: DBusObjectOpts) {
        this.opts = opts
        this.dbus = this.opts.dbus
        this.service = this.opts.dbusService
        this.name = this.opts.objectPath
    }

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
     * Introspect object
     */
    public async introspect(): Promise<IntrospectNode> {
        const [introspectXML] = await this.dbus.invoke({
            service: this.service.name,
            objectPath: this.name,
            interface: 'org.freedesktop.DBus.Introspectable',
            method: 'Introspect'
        })
        const introspectObject: any = await parseXMLString(introspectXML)
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
     * List all interface names
     */
    public async listInterfaces(): Promise<string[]> {
        const introspectResult: IntrospectNode = await this.introspect()
        if (this.#shareIntrospect) this.#shareIntrospectInterfaces = introspectResult.interface
        return introspectResult.interface.map((iface: IntrospectInterface): string => iface.name)
    }

    /**
     * Get all interfaces from object
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
     * Get interface from object
     * @param iface
     */
    public async getInterface(iface: string): Promise<DBusInterface> {
        return await this.internalGetInterface(iface, false)
    }
}