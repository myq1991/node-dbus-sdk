import EventEmitter from 'node:events'
import {DBus} from './DBus'
import {DBusObject} from './DBusObject'
import {DBusInterface} from './DBusInterface'
import {DBusSignalEmitter} from './lib/DBusSignalEmitter'
import {ReceivedSignal} from './types/ReceivedSignal'
import {DBusObjectManagerOpts} from './types/DBusObjectManagerOpts'
import {DBusMessage} from './lib/DBusMessage'
import {DBusSignedValue} from './lib/DBusSignedValue'
import {DecodeOpts} from './types/DecodeOpts'

/**
 * Interfaces of a managed object with their properties: {interface: {property: value}}.
 */
type InterfacesAndProperties = Record<string, Record<string, any>>

/**
 * The entries of a dictionary decoded as an object or, with DecodeOpts.dictionaries 'map', as a Map.
 */
function entriesOf(dictionary: any): [any, any][] {
    return dictionary instanceof Map ? [...dictionary.entries()] : Object.entries(dictionary ?? {})
}

/**
 * A plain-object copy of a property dictionary that keeps the types its values were received with.
 */
function copyProperties(properties: any): Record<string, any> {
    const copy: Record<string, any> = Object.fromEntries(entriesOf(properties))
    DBusSignedValue.copyVariantTypes(properties, copy)
    return copy
}

/**
 * A client for a service's org.freedesktop.DBus.ObjectManager: keeps a local copy of the objects it manages, their
 * interfaces and their properties, and tells you when they change. Get one from DBus.getObjectManager.
 *
 * The copy is filled with GetManagedObjects and kept up to date with InterfacesAdded, InterfacesRemoved and
 * PropertiesChanged. When the service leaves the bus its objects are removed; when it comes back they are read
 * again. Values are plain JavaScript values, as everywhere else.
 *
 * @example
 * const manager = await bus.getObjectManager('org.bluez')
 * for (const path of manager.listObjectPaths()) console.log(path, manager.listInterfaceNames(path))
 * manager.on('objectAdded', (path, interfaces) => console.log('new', path, Object.keys(interfaces)))
 * manager.on('propertiesChanged', (path, iface, changed) => console.log(path, changed))
 * const device = await manager.getInterface('/org/bluez/hci0/dev_00_11_22_33_44_55', 'org.bluez.Device1')
 * await device.method.Connect()
 * manager.close()
 */
export class DBusObjectManager extends EventEmitter {

    readonly #dbus: DBus

    readonly #decode: DecodeOpts | undefined

    /**
     * The managed objects: object path → interface → property → value.
     */
    readonly #objects: Map<string, Map<string, Record<string, any>>> = new Map()

    readonly #managerSignals: DBusSignalEmitter

    readonly #propertySignals: DBusSignalEmitter

    /**
     * Signals received while GetManagedObjects is in progress; undefined otherwise. Once the reply is in, those the
     * service sent after it are applied: a connection numbers everything it sends in order, so the serials tell
     * which signals the reply already reflects. Arrival order alone cannot, since a reply and the signals right
     * after it are dispatched before the code awaiting the reply runs.
     */
    #buffer: ReceivedSignal[] | undefined

    /**
     * Counts loads, so that a load superseded by a newer one (the service restarted meanwhile) is dropped.
     */
    #generation: number = 0

    #closed: boolean = false

    readonly #onSignal = (signal: ReceivedSignal): void => {
        if (this.#buffer) return void this.#buffer.push(signal)
        this.#apply(signal)
    }

    readonly #onNameOwnerChanged = (name: string, _oldOwner: string, newOwner: string): void => {
        if (name !== this.service || this.#closed) return
        // The service left: its objects are gone. A new owner: read them again, once the signal emitters have moved
        // their match rules to it (DBus does that right after this event), so that no change is missed
        this.#generation++
        this.#buffer = undefined
        this.#clear()
        if (newOwner) setImmediate((): void => void this.load().catch((error: Error): void => {
            // Like any EventEmitter, an 'error' event without a listener would throw: report it only when listened to
            if (this.listenerCount('error')) this.emit('error', error)
        }))
    }

    /**
     * The well-known name of the service, e.g. 'org.bluez'.
     */
    public readonly service: string

    /**
     * Path of the object implementing org.freedesktop.DBus.ObjectManager, e.g. '/'.
     */
    public readonly objectPath: string

    /**
     * Created by DBus.getObjectManager, which also loads the objects; not meant to be constructed directly.
     *
     * @param opts - The connection, the service, its current owner, and the path of its object manager.
     */
    constructor(opts: DBusObjectManagerOpts) {
        super()
        this.#dbus = opts.dbus
        // Property values all come in variants, so 'all' amounts to 'variants'; the structure around them is read here
        this.#decode = opts.decode?.types === 'all' ? {...opts.decode, types: 'variants'} : opts.decode
        this.service = opts.service
        this.objectPath = opts.objectPath
        this.#managerSignals = this.#dbus.createSignalEmitter({
            service: opts.service,
            uniqueName: opts.uniqueName,
            objectPath: opts.objectPath,
            interface: 'org.freedesktop.DBus.ObjectManager',
            decode: this.#decode
        })
        this.#managerSignals.onAny(this.#onSignal)
        // One match rule for the properties of every object of the service, rather than one per object
        this.#propertySignals = this.#dbus.createSignalEmitter({
            service: opts.service,
            uniqueName: opts.uniqueName,
            objectPath: '*',
            interface: 'org.freedesktop.DBus.Properties',
            decode: this.#decode
        })
        this.#propertySignals.onAny(this.#onSignal)
        this.#dbus.on('nameOwnerChanged', this.#onNameOwnerChanged)
    }

    /**
     * @internal
     * Reads the managed objects with GetManagedObjects and reports the differences from the local copy as events,
     * then applies the signals the service sent after its reply. The signals are subscribed before the call, so no
     * change is missed.
     *
     * @returns Resolves when the copy is up to date.
     */
    public async load(): Promise<void> {
        const generation: number = ++this.#generation
        const buffer: ReceivedSignal[] = []
        this.#buffer = buffer
        let reply: DBusMessage
        try {
            reply = await this.#dbus.invokeForReply({
                service: this.service,
                objectPath: this.objectPath,
                interface: 'org.freedesktop.DBus.ObjectManager',
                method: 'GetManagedObjects'
            })
        } catch (error) {
            if (generation === this.#generation) this.#buffer = undefined
            throw error
        }
        if (generation !== this.#generation || this.#closed) return
        this.#buffer = undefined
        const objects: [string, any][] = entriesOf(reply.getBody(this.#decode)[0])
        const paths: Set<string> = new Set(objects.map(([objectPath]): string => objectPath))
        for (const objectPath of [...this.#objects.keys()]) {
            if (!paths.has(objectPath)) this.#removeInterfaces(objectPath, [...this.#objects.get(objectPath)!.keys()])
        }
        for (const [objectPath, interfaces] of objects) {
            const known: Map<string, Record<string, any>> | undefined = this.#objects.get(objectPath)
            const names: Set<string> = new Set(entriesOf(interfaces).map(([name]): string => name))
            const gone: string[] = known ? [...known.keys()].filter((name: string): boolean => !names.has(name)) : []
            if (gone.length) this.#removeInterfaces(objectPath, gone)
            this.#addInterfaces(objectPath, interfaces)
        }
        for (const signal of buffer) {
            if (signal.sender === reply.header.sender && signal.message.header.serial > reply.header.serial) this.#apply(signal)
        }
    }

    /**
     * The paths of the managed objects, e.g. ['/org/bluez/hci0'].
     *
     * @returns The object paths, in the order the objects appeared.
     */
    public listObjectPaths(): string[] {
        return [...this.#objects.keys()]
    }

    /**
     * The interfaces of a managed object.
     *
     * @param objectPath - The object's path.
     * @returns The interface names; empty when the object is not managed.
     */
    public listInterfaceNames(objectPath: string): string[] {
        return [...(this.#objects.get(objectPath)?.keys() ?? [])]
    }

    /**
     * The properties of an interface of a managed object, as last reported by the service.
     *
     * @param objectPath - The object's path.
     * @param interfaceName - The interface name.
     * @returns A copy of {property: value}; undefined when the object or interface is not managed.
     */
    public getProperties(objectPath: string, interfaceName: string): Record<string, any> | undefined {
        const properties: Record<string, any> | undefined = this.#objects.get(objectPath)?.get(interfaceName)
        return properties ? copyProperties(properties) : undefined
    }

    /**
     * Everything managed, in the shape GetManagedObjects returns.
     *
     * @returns A copy of {object path: {interface: {property: value}}}.
     */
    public getManagedObjects(): Record<string, Record<string, Record<string, any>>> {
        const objects: Record<string, InterfacesAndProperties> = {}
        for (const [objectPath, interfaces] of this.#objects) {
            objects[objectPath] = {}
            for (const [interfaceName, properties] of interfaces) objects[objectPath][interfaceName] = copyProperties(properties)
        }
        return objects
    }

    /**
     * A proxy for a managed object, to call its methods; see DBus.getObject.
     *
     * @param objectPath - The object's path.
     * @returns The object proxy.
     */
    public async getObject(objectPath: string): Promise<DBusObject> {
        return this.#dbus.getObject(this.service, objectPath)
    }

    /**
     * A proxy for an interface of a managed object, to call its methods and use its properties; see
     * DBus.getInterface.
     *
     * @param objectPath - The object's path.
     * @param interfaceName - The interface name.
     * @returns The interface proxy.
     * @throws {InterfaceNotFoundError} When the object does not have the interface.
     */
    public async getInterface(objectPath: string, interfaceName: string): Promise<DBusInterface> {
        return this.#dbus.getInterface(this.service, objectPath, interfaceName)
    }

    /**
     * Stops following the service: removes the match rules and listeners. The local copy keeps its last state.
     */
    public close(): void {
        if (this.#closed) return
        this.#closed = true
        this.#generation++
        this.#managerSignals.removeAllListeners()
        this.#propertySignals.removeAllListeners()
        this.#dbus.off('nameOwnerChanged', this.#onNameOwnerChanged)
    }

    /**
     * Listens to the 'objectAdded' event, emitted when an object appears, with its {interface: {property: value}}.
     *
     * @param eventName - 'objectAdded'.
     * @param listener - Called with the object path and its interfaces and properties.
     * @returns This object manager.
     */
    public on(eventName: 'objectAdded', listener: (objectPath: string, interfaces: Record<string, Record<string, any>>) => void): this
    /**
     * Listens to the 'objectRemoved' event, emitted when an object disappears, with the interfaces it had.
     *
     * @param eventName - 'objectRemoved'.
     * @param listener - Called with the object path and interface names.
     * @returns This object manager.
     */
    public on(eventName: 'objectRemoved', listener: (objectPath: string, interfaceNames: string[]) => void): this
    /**
     * Listens to the 'interfacesAdded' event, emitted when an existing object gains interfaces.
     *
     * @param eventName - 'interfacesAdded'.
     * @param listener - Called with the object path and the added {interface: {property: value}}.
     * @returns This object manager.
     */
    public on(eventName: 'interfacesAdded', listener: (objectPath: string, interfaces: Record<string, Record<string, any>>) => void): this
    /**
     * Listens to the 'interfacesRemoved' event, emitted when an object loses some, but not all, of its interfaces.
     *
     * @param eventName - 'interfacesRemoved'.
     * @param listener - Called with the object path and the removed interface names.
     * @returns This object manager.
     */
    public on(eventName: 'interfacesRemoved', listener: (objectPath: string, interfaceNames: string[]) => void): this
    /**
     * Listens to the 'propertiesChanged' event, emitted when PropertiesChanged arrives for a managed object, after the
     * copy was updated (invalidated properties are removed from it).
     *
     * @param eventName - 'propertiesChanged'.
     * @param listener - Called with the object path, interface, changed properties and invalidated property names.
     * @returns This object manager.
     */
    public on(eventName: 'propertiesChanged', listener: (objectPath: string, interfaceName: string, changed: Record<string, any>, invalidated: string[]) => void): this
    /**
     * Listens to the 'error' event, emitted when reading the objects again after the service restarted fails.
     *
     * @param eventName - 'error'.
     * @param listener - Called with the error.
     * @returns This object manager.
     */
    public on(eventName: 'error', listener: (error: Error) => void): this
    /**
     * Listens to an event by name.
     *
     * @param eventName - The event.
     * @param listener - Called with the event's arguments.
     * @returns This object manager.
     */
    public on(eventName: string, listener: (...args: any[]) => void): this
    public on(eventName: string, listener: (...args: any[]) => void): this {
        return super.on(eventName, listener)
    }

    /**
     * Applies an InterfacesAdded, InterfacesRemoved or PropertiesChanged signal to the copy.
     */
    #apply(signal: ReceivedSignal): void {
        if (signal.interface === 'org.freedesktop.DBus.ObjectManager') {
            if (signal.objectPath !== this.objectPath) return
            if (signal.name === 'InterfacesAdded') return this.#addInterfaces(signal.args[0], signal.args[1])
            if (signal.name === 'InterfacesRemoved') return this.#removeInterfaces(signal.args[0], signal.args[1])
            return
        }
        if (signal.name !== 'PropertiesChanged') return
        const [interfaceName, changedDictionary, invalidated] = signal.args as [string, any, string[]]
        const properties: Record<string, any> | undefined = this.#objects.get(signal.objectPath)?.get(interfaceName)
        if (!properties) return // Not a managed object, or an interface it does not report
        const changed: Record<string, any> = copyProperties(changedDictionary)
        Object.assign(properties, changed)
        DBusSignedValue.copyVariantTypes(changed, properties)
        for (const name of invalidated) delete properties[name]
        this.emit('propertiesChanged', signal.objectPath, interfaceName, changed, [...invalidated])
    }

    #addInterfaces(objectPath: string, interfaces: InterfacesAndProperties): void {
        let object: Map<string, Record<string, any>> | undefined = this.#objects.get(objectPath)
        const isNew: boolean = !object
        if (!object) {
            object = new Map()
            this.#objects.set(objectPath, object)
        }
        const added: InterfacesAndProperties = {}
        for (const [interfaceName, properties] of entriesOf(interfaces)) {
            const known: boolean = object.has(interfaceName)
            object.set(interfaceName, copyProperties(properties))
            if (!known) added[interfaceName] = copyProperties(properties)
        }
        if (isNew) return void this.emit('objectAdded', objectPath, added)
        if (Object.keys(added).length) this.emit('interfacesAdded', objectPath, added)
    }

    #removeInterfaces(objectPath: string, interfaceNames: string[]): void {
        const object: Map<string, Record<string, any>> | undefined = this.#objects.get(objectPath)
        if (!object) return
        const removed: string[] = interfaceNames.filter((name: string): boolean => object.delete(name))
        if (!object.size) {
            this.#objects.delete(objectPath)
            return void this.emit('objectRemoved', objectPath, removed)
        }
        if (removed.length) this.emit('interfacesRemoved', objectPath, removed)
    }

    #clear(): void {
        for (const objectPath of [...this.#objects.keys()]) this.#removeInterfaces(objectPath, [...this.#objects.get(objectPath)!.keys()])
    }
}
