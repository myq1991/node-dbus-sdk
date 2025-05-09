import {DBusInterfaceOpts} from './types/DBusInterfaceOpts'

export class DBusInterface {
    protected readonly opts: DBusInterfaceOpts

    constructor(opts: DBusInterfaceOpts) {
        this.opts = opts
        //TODO
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