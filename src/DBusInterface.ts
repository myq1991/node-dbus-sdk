import {DBusInterfaceOpts} from './types/DBusInterfaceOpts'
import {DBus} from './DBus'
import {DBusService} from './DBusService'
import {DBusObject} from './DBusObject'
import {IntrospectInterface} from './types/IntrospectInterface'

export class DBusInterface {
    protected readonly opts: DBusInterfaceOpts

    protected readonly dbus: DBus

    protected readonly service: DBusService

    protected readonly object: DBusObject

    protected readonly introspectInterface: IntrospectInterface

    public readonly name: string

    constructor(opts: DBusInterfaceOpts) {
        this.opts = opts
        this.name = this.opts.iface
        this.dbus = this.opts.dbus
        this.service = this.opts.dbusService
        this.object = this.opts.dbusObject
        this.introspectInterface = this.opts.introspectInterface
    }

    public async getMethods() {
        //TODO
    }

    public async getProperties() {
        //TODO
    }

    public async getSignals() {
        //TODO
    }

    public async getMethod(method: string) {
    }

    public async getProperty(property: string) {
    }

    public async getSignal(signal: string) {
    }
}