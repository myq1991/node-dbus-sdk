import {DBusService} from './DBusService'
import {DBusObject} from './DBusObject'
import {DBusInterface} from './DBusInterface'
import {ConnectOpts} from './types/ConnectOpts'
import {DBusConnection} from './lib/DBusConnection'
import {DBusMessage} from './lib/DBusMessage'

export class DBus {

    #connection: DBusConnection

    #uniqueId: string

    /**
     * Connect to DBus
     * @param opts
     */
    public static async connect(opts: ConnectOpts): Promise<DBus> {
        return new DBus(await DBusConnection.createConnection(opts))
    }

    /**
     * Write data to DBus socket
     * @param data
     */
    public write(data: Buffer) {
        this.#connection.write(data)
    }

    public async invokeMethod(){}

    public async getProperty(){}

    public async setProperty(){}


    public _write() {
        // // const buf=new DBusMessage({
        // //     serial: 1,
        // //     destination: 'org.ptswitch.pad',
        // //     path: '/slot1/port1/stc',
        // //     interfaceName: 'pad.stc',
        // //     member: 'portGetSpeed'
        // // }).toBuffer()
        //
        // // const buf = new DBusMessage({
        // //     serial: 1,
        // //     type: 1,
        // //     destination: 'org.freedesktop.DBus',
        // //     path: '/org/freedesktop/DBus',
        // //     interfaceName: 'org.freedesktop.DBus',
        // //     member: 'Hello'
        // // }).toBuffer()
        const buf = DBusMessage.encode({
            serial: 1,
            type: 1,
            destination: 'org.freedesktop.DBus',
            path: '/org/freedesktop/DBus',
            interfaceName: 'org.freedesktop.DBus',
            member: 'Hello'
        })
        console.log(JSON.stringify(Array.from(buf)), buf.length)
        this.#connection.write(buf)


        setInterval(() => {
            const buf2 = DBusMessage.encode({
                serial: 2,
                type: 1,
                flags: 0x01,
                destination: 'org.ptswitch.pad',
                path: '/slot1/port1/stc',
                interfaceName: 'pad.stc',
                member: 'portGetSpeed'
            })
            console.log(JSON.stringify(Array.from(buf2)), buf2.length)
            this.#connection.write(buf2)
        }, 5000)

        // const l=Buffer.from([108,1,0,1,0,0,0,0,1,0,0,0,109,0,0,0,1,1,111,0,21,0,0,0,47,111,114,103,47,102,114,101,101,100,101,115,107,116,111,112,47,68,66,117,115,0,0,0,2,1,115,0,20,0,0,0,111,114,103,46,102,114,101,101,100,101,115,107,116,111,112,46,68,66,117,115,0,0,0,0,3,1,115,0,5,0,0,0,72,101,108,108,111,0,0,0,6,1,115,0,20,0,0,0,111,114,103,46,102,114,101,101,100,101,115,107,116,111,112,46,68,66,117,115,0,0,0,0])
        // console.log(l.toString('hex'))

        // this.#connection.write(Buffer.from([108,1,0,1,0,0,0,0,1,0,0,0,109,0,0,0,1,1,111,0,21,0,0,0,47,111,114,103,47,102,114,101,101,100,101,115,107,116,111,112,47,68,66,117,115,0,0,0,2,1,115,0,20,0,0,0,111,114,103,46,102,114,101,101,100,101,115,107,116,111,112,46,68,66,117,115,0,0,0,0,3,1,115,0,5,0,0,0,72,101,108,108,111,0,0,0,6,1,115,0,20,0,0,0,111,114,103,46,102,114,101,101,100,101,115,107,116,111,112,46,68,66,117,115,0,0,0,0]))
        // const buf=Buffer.from('4201000001010000010000000000000000000000000000000000000000000000010000006F00000001016F001500000072672E667265656465736B746F702E4442757300000002017300140000002F6F72672F667265656465736B746F702F4442757300000003017300130000006F72672E667265656465736B746F702E444275730000040173000500000048656C6C6F0000000000','hex')
        // console.log(JSON.stringify(Array.from(buf)),buf.length)
        // this.#connection.write(buf)
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