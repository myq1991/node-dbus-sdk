import {DBusObjectOpts} from './types/DBusObjectOpts'
import {DBusInterface} from './DBusInterface'
import {DBus} from './DBus'
import {DBusService} from './DBusService'

export class DBusObject {

    protected readonly opts: DBusObjectOpts

    protected readonly dbus: DBus

    protected readonly service: DBusService

    public readonly name: string

    constructor(opts: DBusObjectOpts) {
        this.opts = opts
        this.dbus = this.opts.dbus
        this.service = this.opts.dbusService
        this.name = this.opts.objectPath
    }

    /**
     * List all interface names
     */
    public async listInterfaces(): Promise<string[]> {
        //TODO
        return []
    }

    /**
     * Get all interfaces from object
     */
    public async getInterfaces(): Promise<DBusInterface[]> {
        const interfaceNames: string[] = await this.listInterfaces()
        return Promise.all(interfaceNames.map((interfaceName: string): Promise<DBusInterface> => this.getInterface(interfaceName)))
    }

    /**
     * Get interface from object
     * @param iface
     */
    public async getInterface(iface: string): Promise<DBusInterface> {
        return new DBusInterface({
            ...this.opts,
            iface: iface,
            dbusObject: this
        })
    }
}