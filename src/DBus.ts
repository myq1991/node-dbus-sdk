import {DBusService} from './DBusService'
import {DBusObject} from './DBusObject'
import {DBusInterface} from './DBusInterface'
import {ConnectOpts} from './types/ConnectOpts'
import {DBusConnection} from './lib/DBusConnection'
import {DBusMessage} from './lib/DBusMessage'

export class DBus {

    #connection: DBusConnection

    /**
     * Connect to DBus
     * @param opts
     */
    public static async connect(opts: ConnectOpts): Promise<DBus> {
        return new DBus(await DBusConnection.createConnection(opts))
    }

    public write() {
        // const buf=new DBusMessage({
        //     serial: 1,
        //     destination: 'org.ptswitch.pad',
        //     path: '/slot1/port1/stc',
        //     interfaceName: 'pad.stc',
        //     member: 'portGetSpeed'
        // }).toBuffer()

        // const buf = new DBusMessage({
        //     serial: 1,
        //     type: 1,
        //     destination: 'org.freedesktop.DBus',
        //     path: '/org/freedesktop/DBus',
        //     interfaceName: 'org.freedesktop.DBus',
        //     member: 'Hello'
        // }).toBuffer()
        const buf = DBusMessage.encode({
            serial: 1,
            type: 1,
            destination: 'org.freedesktop.DBus',
            path: '/org/freedesktop/DBus',
            interfaceName: 'org.freedesktop.DBus',
            member: 'Hello'
        })
        this.#connection.write(buf)
        // this.#connection.write(Buffer.from([108,1,0,1,0,0,0,0,1,0,0,0,109,0,0,0,1,1,111,0,21,0,0,0,47,111,114,103,47,102,114,101,101,100,101,115,107,116,111,112,47,68,66,117,115,0,0,0,2,1,115,0,20,0,0,0,111,114,103,46,102,114,101,101,100,101,115,107,116,111,112,46,68,66,117,115,0,0,0,0,3,1,115,0,5,0,0,0,72,101,108,108,111,0,0,0,6,1,115,0,20,0,0,0,111,114,103,46,102,114,101,101,100,101,115,107,116,111,112,46,68,66,117,115,0,0,0,0]))
    }

    /**
     * DBus constructor
     * @param connection
     */
    constructor(connection: DBusConnection) {
        this.#connection = connection
        this.#connection.on('message', console.log)
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