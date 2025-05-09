import {Duplex} from 'node:stream'
import {DBusService} from './DBusService'
import {DBusObject} from './DBusObject'
import {DBusInterface} from './DBusInterface'

export class DBus {
    constructor(socket: Duplex) {
        //TODO
    }

    public async getService(service: string): Promise<DBusService> {
        //TODO 需要判断服务是否存在
        return new DBusService({dbus: this, service: service})
    }

    public async getObject(service: string, objectPath: string): Promise<DBusObject> {
        return (await this.getService(service)).getObject(objectPath)
    }

    public async getInterface(service: string, objectPath: string, iface: string): Promise<DBusInterface> {
        return (await this.getObject(service, objectPath)).getInterface(iface)
    }
}