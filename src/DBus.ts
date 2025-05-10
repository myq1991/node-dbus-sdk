import {DBusService} from './DBusService'
import {DBusObject} from './DBusObject'
import {DBusInterface} from './DBusInterface'
import {ConnectOpts} from './types/ConnectOpts'
import {DBusConnection} from './lib/DBusConnection'

export class DBus {

    /**
     * Connect to DBus
     * @param opts
     */
    public static async connect(opts: ConnectOpts): Promise<DBus> {
        return new DBus(await DBusConnection.createConnection(opts))
    }

    /**
     * DBus constructor
     * @param connection
     */
    constructor(connection: DBusConnection) {
        //TODO
    }

    /**
     * List all services
     */
    public async listServices(): Promise<string[]> {
        //TODO
        return []
    }

    /**
     * Get all services
     */
    public async getServices(): Promise<DBusService[]> {
        const serviceNames: string[] = await this.listServices()
        return Promise.all(serviceNames.map((serviceName: string): Promise<DBusService> => this.getService(serviceName)))
    }

    /**
     * Get service
     * @param service
     */
    public async getService(service: string): Promise<DBusService> {
        //TODO 需要判断服务是否存在
        return new DBusService({dbus: this, service: service})
    }

    /**
     * Get object
     * @param service
     * @param objectPath
     */
    public async getObject(service: string, objectPath: string): Promise<DBusObject> {
        return (await this.getService(service)).getObject(objectPath)
    }

    /**
     * Get Interface
     * @param service
     * @param objectPath
     * @param iface
     */
    public async getInterface(service: string, objectPath: string, iface: string): Promise<DBusInterface> {
        return (await this.getObject(service, objectPath)).getInterface(iface)
    }
}