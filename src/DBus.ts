import {MessageBus} from './MessageBus'
import {messageType} from './lib/Constants'
import {ConnectOptions, DBusConnection} from './DBusConnection'
import {IHandshakeOptions} from './types/IHandshakeOptions'
import {DBusService} from './DBusService'
import {DBusObject} from './DBusObject'

export class DBus {

    public readonly bus: MessageBus

    constructor(bus: MessageBus) {
        this.bus = bus
    }

    /**
     * Connect to other bus
     * @param options
     */
    public static async connect(options?: ConnectOptions & IHandshakeOptions): Promise<DBus> {
        const connection: DBusConnection = await DBusConnection.createConnection(options || {})
        return await new DBus(new MessageBus(connection, options || {})).init()
    }

    /**
     * Connect to system bus
     * @param options
     */
    public static async systemBus(options?: IHandshakeOptions): Promise<DBus> {
        return await this.connect({
            ...options,
            busAddress: process.env.DBUS_SYSTEM_BUS_ADDRESS || 'unix:path=/var/run/dbus/system_bus_socket'
        })
    }

    /**
     * Connect to session bus
     * @param options
     */
    public static async sessionBus(options?: ConnectOptions & IHandshakeOptions): Promise<DBus> {
        return await this.connect(options)
    }

    public async getServices(): Promise<string[]> {
        const dbusObject: DBusObject = await this.getService('org.freedesktop.DBus').getObject('/org/freedesktop/DBus')
        const serviceNames: string[] = await dbusObject.getInterface('org.freedesktop.DBus').methods.ListNames.call()
        return serviceNames.filter((serviceName: string): boolean => !serviceName.startsWith(':'))
    }

    /**
     * Get DBus service by name
     * @param name
     */
    public getService(name: string): DBusService {
        return new DBusService(name, this.bus)
    }

    protected async init(): Promise<this> {
        //TODO 初始化函数需要做的事情
        this.bus.signals.on(this.bus.mangle({
            path: '/slot1/port4/stc',
            interface: 'org.freedesktop.DBus.Properties',
            member: 'PropertiesChanged'
        }), (data: any, signature: string) => {
            console.log(data, signature)
        })
        await this.bus.invoke({
            type: messageType.methodCall,
            destination: 'org.freedesktop.DBus',
            path: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            member: 'AddMatch',
            signature: 's',
            body: ['type=signal'] // 匹配所有信号类型
        })
        console.log(await this.getServices())
        return this
    }


}