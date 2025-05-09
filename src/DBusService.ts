import {DBusServiceOpts} from './types/DBusServiceOpts'
import {DBusObject} from './DBusObject'

export class DBusService {
    protected readonly opts: DBusServiceOpts

    constructor(opts: DBusServiceOpts) {
        this.opts = opts
    }

    /**
     * List all object paths
     */
    public async listObjects(): Promise<string[]> {
        //TODO
        return []
    }

    /**
     * Get all objects from dbus service
     */
    public async getObjects(): Promise<DBusObject[]> {
        const objectPaths: string[] = await this.listObjects()
        return Promise.all(objectPaths.map((objectPath: string): Promise<DBusObject> => this.getObject(objectPath)))
    }

    /**
     * Get object from dbus service
     * @param objectPath
     */
    public async getObject(objectPath: string): Promise<DBusObject> {
        return new DBusObject({
            ...this.opts,
            objectPath: objectPath
        })
    }
}