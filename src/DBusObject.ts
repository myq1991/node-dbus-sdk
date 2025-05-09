import {DBusObjectOpts} from './types/DBusObjectOpts'
import {DBusInterface} from './DBusInterface'

export class DBusObject {
    protected readonly opts: DBusObjectOpts

    constructor(opts: DBusObjectOpts) {
        this.opts = opts
        //TODO
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
            iface: iface
        })
    }
}