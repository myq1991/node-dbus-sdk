import {DBusService} from './DBusService'
import {DBusObject} from './DBusObject'
import {DBusInterface} from './DBusInterface'
import {ConnectOpts} from './types/ConnectOpts'
import {DBusConnection} from './lib/DBusConnection'
import {DBusMessage} from './lib/DBusMessage'
import {InvokeOpts} from './types/InvokeOpts'
import {DBusMessageFlags} from './lib/enums/DBusMessageFlags'
import {DBusMessageType} from './lib/enums/DBusMessageType'
import {GetPropertyValueOpts} from './types/GetPropertyValueOpts'
import {SetPropertyValueOpts} from './types/SetPropertyValueOpts'
import {DBusSignedValue} from './lib/DBusSignedValue'
import {CreateSignalEmitterOpts} from './types/CreateSignalEmitterOpts'
import {DBusSignalEmitter} from './lib/DBusSignalEmitter'
import {ServiceBasicInfo} from './types/ServiceBasicInfo'
import {RequestNameFlags} from './lib/enums/RequestNameFlags'
import {RequestNameResultCode} from './lib/enums/RequestNameResultCode'
import {ServiceNotFoundError} from './lib/Errors'
import EventEmitter from 'node:events'
import {ReplyOpts} from './types/ReplyOpts'
import {EmitSignalOpts} from './types/EmitSignalOpts'
import {BusNameBasicInfo} from './types/BusNameBasicInfo'
import {CreateDBusError} from './lib/CreateDBusError'

/**
 * Main class for interacting with a DBus connection.
 * Provides methods for connecting to DBus, invoking methods, handling signals,
 * managing services, objects, and interfaces, and other DBus operations.
 * Extends EventEmitter to emit events for connection status and DBus signals.
 */
export class DBus extends EventEmitter {

    /**
     * The underlying DBus connection instance.
     * Manages the low-level communication with the DBus daemon.
     */
    #connection: DBusConnection

    /**
     * The unique name assigned to this connection by the DBus daemon (e.g., ':1.123').
     * Set after a successful 'Hello' call during initialization.
     */
    #uniqueName: string

    /**
     * A counter for message serial numbers.
     * Incremented for each message sent to ensure unique identification.
     */
    #serial: number = 1

    /**
     * A record of pending method calls awaiting responses.
     * Maps serial numbers to callback functions for resolving or rejecting the call.
     */
    #inflightCalls: Record<number, [(response: any[]) => void, (error: Error) => void]> = {}

    /**
     * A set of WeakRef objects referencing DBusSignalEmitter instances.
     * Used for garbage collection of signal emitters when they are no longer needed.
     */
    #signalEmitterWeakRefSet: Set<WeakRef<DBusSignalEmitter>> = new Set()

    /**
     * A set of active DBusSignalEmitter instances.
     * Tracks signal emitters for dispatching incoming signals.
     */
    #signalEmitters: Set<DBusSignalEmitter> = new Set()

    /**
     * A map of signal matching rules to their formatted rule strings.
     * Used to manage DBus signal subscription rules.
     */
    #signalRulesMap: Map<Record<string, string>, string> = new Map()

    /**
     * A set of WeakRef objects referencing DBusService instances.
     * Used for garbage collection of services and updating their unique names.
     */
    #weakServiceSet: Set<WeakRef<DBusService>> = new Set()

    /**
     * The DBus management interface for interacting with the DBus daemon.
     * Provides access to standard DBus methods like name management and signal subscription.
     */
    #dbusManageInterface: DBusInterface

    /**
     * Getter for the unique name of this DBus connection.
     *
     * @returns The unique name assigned by the DBus daemon.
     */
    public get uniqueName(): string {
        return this.#uniqueName
    }

    /**
     * Static method to connect to a DBus instance.
     * Creates a new DBus connection with the provided options and initializes it.
     *
     * @param opts - Connection options (e.g., socket, TCP, or stream settings).
     * @returns A Promise resolving to an initialized DBus instance.
     */
    public static async connect(opts: ConnectOpts): Promise<DBus> {
        const bus: DBus = new DBus(await DBusConnection.createConnection(opts))
        return await bus.initialize()
    }

    /**
     * Initializes the DBus connection.
     * Performs a 'Hello' call to get a unique name, sets up the management interface,
     * and updates services and signal emitters with current name owners.
     *
     * @returns A Promise resolving to this DBus instance after initialization.
     */
    protected async initialize(): Promise<this> {
        await this.hello()
        if (this.#dbusManageInterface) this.#dbusManageInterface.signal.removeAllListeners()
        if (this.#weakServiceSet.size || this.#signalEmitterWeakRefSet.size) {
            const nameInfos: BusNameBasicInfo[] = await this.listBusNames()
            const names: string[] = nameInfos.map((nameInfo: BusNameBasicInfo): string => nameInfo.name)
            this.#weakServiceSet.forEach((serviceWeakRef: WeakRef<DBusService>): void => {
                const dbusService: DBusService | undefined = serviceWeakRef.deref()
                if (!dbusService) {
                    this.#weakServiceSet.delete(serviceWeakRef)
                    return
                }
                if (!names.includes(dbusService.name)) return
                const index: number = names.indexOf(dbusService.name)
                if (dbusService.uniqueName !== nameInfos[index].uniqueName) updateServiceUniqueName.call(dbusService, nameInfos[index].uniqueName ? nameInfos[index].uniqueName : '')
            })
            this.#signalEmitterWeakRefSet.forEach((emitterRef: WeakRef<DBusSignalEmitter>): void => {
                const emitter: DBusSignalEmitter | undefined = emitterRef.deref()
                if (!emitter) {
                    this.#signalEmitterWeakRefSet.delete(emitterRef)
                    return
                }
                if (!names.includes(emitter.service)) return
                const index: number = names.indexOf(emitter.service)
                if (emitter.uniqueName !== nameInfos[index].uniqueName) return
                updateEmitterUniqueName.call(emitter, nameInfos[index].uniqueName)
            })
        }
        this.#dbusManageInterface = await this.getInterface('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus')
        const updateServiceUniqueName: (this: DBusService, newUniqueName: string) => void = function (this: DBusService, newUniqueName: string): void {
            this.updateUniqueName(newUniqueName)
        }
        const updateEmitterUniqueName: (this: DBusSignalEmitter, newUniqueName: string) => void = function (this: DBusSignalEmitter, newUniqueName: string): void {
            this.updateUniqueName(newUniqueName)
        }
        this.#dbusManageInterface.signal
            .on('NameOwnerChanged', (name: string, oldOwner: string, newOwner: string): void => {
                this.emit('NameOwnerChanged', name, oldOwner, newOwner)
                this.#weakServiceSet.forEach((serviceWeakRef: WeakRef<DBusService>): void => {
                    const dbusService: DBusService | undefined = serviceWeakRef.deref()
                    if (!dbusService) {
                        this.#weakServiceSet.delete(serviceWeakRef)
                        return
                    }
                    if (dbusService.name !== name) return
                    if (dbusService.uniqueName !== newOwner) updateServiceUniqueName.call(dbusService, newOwner)
                })
                this.#signalEmitterWeakRefSet.forEach((emitterRef: WeakRef<DBusSignalEmitter>): void => {
                    const emitter: DBusSignalEmitter | undefined = emitterRef.deref()
                    if (!emitter) {
                        this.#signalEmitterWeakRefSet.delete(emitterRef)
                        return
                    }
                    if (emitter.uniqueName !== oldOwner) return
                    updateEmitterUniqueName.call(emitter, newOwner)
                })
                if (!!name && !oldOwner && !!newOwner) this.emit('online', name)
                if (!!name && !!oldOwner && !newOwner) this.emit('offline', name)
                if (!!name && !!oldOwner && !!newOwner) this.emit('replaced', name)
            })
            .on('NameLost', (name: string): void => {
                this.emit('NameLost', name)
            })
            .on('NameAcquired', (name: string): void => {
                this.emit('NameAcquired', name)
            })
        return this
    }

    /**
     * Sends a 'Hello' message to the DBus daemon to obtain a unique connection name.
     * Sets the unique name for this connection upon successful response.
     *
     * @returns A Promise that resolves when the unique name is set.
     */
    protected async hello(): Promise<void> {
        const [uniqueName] = await this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            method: 'Hello'
        })
        this.#uniqueName = uniqueName
    }

    /**
     * Writes raw data to the DBus socket.
     * Throws an error if the connection is not active.
     *
     * @param data - The Buffer containing the data to write to the DBus socket.
     * @throws {Error} If the DBus connection is disconnected.
     */
    public write(data: Buffer): void {
        if (!this.#connection.connected) throw CreateDBusError('org.freedesktop.DBus.Error.Disconnected', 'DBus disconnected')
        this.#connection.write(data)
    }

    /**
     * Emits a DBus signal with the specified options.
     * Encodes and writes the signal message to the DBus socket.
     *
     * @param opts - Options for emitting the signal, including object path, interface, signal name, and data.
     */
    public emitSignal(opts: EmitSignalOpts): void {
        this.write(DBusMessage.encode({
            serial: this.#serial++,
            type: DBusMessageType.SIGNAL,
            flags: DBusMessageFlags.NO_REPLY_EXPECTED,
            sender: this.#uniqueName,
            path: opts.objectPath,
            interfaceName: opts.interface,
            member: opts.signal,
            destination: opts.destination,
            signature: opts.signature ? opts.signature : undefined
        }, ...opts.data ? opts.data : []))
    }

    /**
     * Sends a reply to a DBus method call.
     * Handles both successful responses and error replies.
     *
     * @param opts - Options for the reply, including serial number, destination, and data or error.
     */
    public reply(opts: ReplyOpts): void {
        if (opts.data instanceof Error) {
            this.write(DBusMessage.encode({
                serial: this.#serial++,
                replySerial: opts.replySerial,
                type: DBusMessageType.ERROR,
                flags: DBusMessageFlags.NO_REPLY_EXPECTED,
                sender: this.#uniqueName,
                destination: opts.destination,
                errorName: opts.data.name,
                signature: opts.signature ? opts.signature : undefined
            }, opts.data.message))
        } else {
            this.write(DBusMessage.encode({
                serial: this.#serial++,
                replySerial: opts.replySerial,
                type: DBusMessageType.METHOD_RETURN,
                flags: DBusMessageFlags.NO_REPLY_EXPECTED,
                sender: this.#uniqueName,
                destination: opts.destination,
                signature: opts.signature ? opts.signature : undefined
            }, ...(opts.data ? opts.data : [])))
        }
    }

    /**
     * Invokes a DBus method call with the specified options.
     * Can be used with or without expecting a reply.
     *
     * @param opts - Options for the method call, including service, object path, interface, method, and arguments.
     * @param noReply - Boolean indicating if a reply is expected (default: false).
     * @returns A Promise resolving to the response data if a reply is expected, otherwise void.
     */
    public invoke(opts: InvokeOpts, noReply: true): void
    public async invoke(opts: InvokeOpts, noReply: false): Promise<any[]>
    public async invoke(opts: InvokeOpts): Promise<any[]>
    public invoke(opts: InvokeOpts, noReply: boolean = false): Promise<any[]> | void {
        if (noReply) {
            this.write(DBusMessage.encode({
                serial: this.#serial++,
                type: DBusMessageType.METHOD_CALL,
                flags: DBusMessageFlags.NO_REPLY_EXPECTED,
                destination: opts.service,
                path: opts.objectPath,
                interfaceName: opts.interface,
                member: opts.method,
                signature: opts.signature ? opts.signature : undefined
            }, ...opts.args ? opts.args : []))
        } else {
            return new Promise<any[]>((resolve, reject) => {
                const message: DBusMessage = new DBusMessage({
                    serial: this.#serial++,
                    type: DBusMessageType.METHOD_CALL,
                    flags: DBusMessageFlags.REPLY_EXPECTED,
                    destination: opts.service,
                    path: opts.objectPath,
                    interfaceName: opts.interface,
                    member: opts.method,
                    signature: opts.signature ? opts.signature : undefined
                }, ...opts.args ? opts.args : [])
                this.#inflightCalls[message.header.serial] = [resolve, reject]
                this.write(message.toBuffer())
            })
        }
    }

    /**
     * Retrieves the value of a DBus property using the Properties interface.
     *
     * @param opts - Options for getting the property, including service, object path, interface, and property name.
     * @returns A Promise resolving to the property value.
     */
    public async getProperty(opts: GetPropertyValueOpts): Promise<any> {
        const [value] = await this.invoke({
            service: opts.service,
            objectPath: opts.objectPath,
            interface: 'org.freedesktop.DBus.Properties',
            method: 'Get',
            signature: 'ss',
            args: [opts.interface, opts.property]
        })
        return value
    }

    /**
     * Sets the value of a DBus property using the Properties interface.
     *
     * @param opts - Options for setting the property, including service, object path, interface, property name, value, and signature.
     * @returns A Promise that resolves when the property is set.
     */
    public async setProperty(opts: SetPropertyValueOpts): Promise<void> {
        const signedValue: DBusSignedValue = opts.signature ? new DBusSignedValue('v', new DBusSignedValue(opts.signature, opts.value)) : new DBusSignedValue('v', opts.value)
        await this.invoke({
            service: opts.service,
            objectPath: opts.objectPath,
            interface: 'org.freedesktop.DBus.Properties',
            method: 'Set',
            signature: 'ssv',
            args: [opts.interface, opts.property, signedValue]
        })
    }

    /**
     * Formats a DBus match rule string for signal subscription.
     *
     * @param uniqueName - The sender's unique name or '*' for any.
     * @param objectPath - The object path or '*' for any.
     * @param interfaceName - The interface name or '*' for any.
     * @param signalName - The signal name or '*' for any.
     * @returns The formatted match rule string.
     */
    protected formatMatchSignalRule(uniqueName: string | '*', objectPath: string | '*', interfaceName: string | '*', signalName: string): string {
        const matchSignalRules: string[] = ['type=signal']
        if (uniqueName !== '*') matchSignalRules.push(`sender=${uniqueName}`)
        if (objectPath !== '*') matchSignalRules.push(`path=${objectPath}`)
        if (interfaceName !== '*') matchSignalRules.push(`interface=${interfaceName}`)
        if (signalName !== '*') matchSignalRules.push(`member=${signalName}`)
        return matchSignalRules.join(',')
    }

    /**
     * Registers a signal subscription rule with the DBus daemon.
     *
     * @param uniqueName - The sender's unique name or '*' for any.
     * @param objectPath - The object path or '*' for any.
     * @param interfaceName - The interface name or '*' for any.
     * @param signalName - The signal name or '*' for any.
     */
    protected onSignal(uniqueName: string | '*', objectPath: string | '*', interfaceName: string | '*', signalName: string | '*'): void {
        const rules: Record<string, string> = {
            uniqueName: uniqueName,
            objectPath: objectPath,
            interfaceName: interfaceName,
            signalName: signalName
        }
        this.#signalRulesMap.set(rules, this.formatMatchSignalRule(uniqueName, objectPath, interfaceName, signalName))
        return this.addMatch(this.#signalRulesMap.get(rules)!)
    }

    /**
     * Removes a signal subscription rule from the DBus daemon.
     *
     * @param signalRuleString - The formatted rule string to remove.
     */
    protected offSignal(signalRuleString: string): void {
        return this.removeMatch(signalRuleString)
    }

    /**
     * Creates a signal emitter for listening to DBus signals.
     *
     * @param opts - Options for creating the signal emitter, including service, object path, and interface.
     * @returns A DBusSignalEmitter instance for handling signals.
     */
    public createSignalEmitter(opts: CreateSignalEmitterOpts): DBusSignalEmitter {
        const signalEmitter: DBusSignalEmitter = new DBusSignalEmitter(
            opts,
            this.#signalEmitters,
            (
                service: string | '*',
                objectPath: string | '*',
                interfaceName: string | '*',
                signalName: string | '*'
            ): void => this.onSignal(
                service,
                objectPath,
                interfaceName,
                signalName
            )
        )
        this.#signalEmitterWeakRefSet.add(new WeakRef(signalEmitter))
        return signalEmitter
    }

    /**
     * Constructor for the DBus class.
     * Sets up the connection and event listeners for messages, connection closure, and errors.
     *
     * @param connection - The DBusConnection instance to use for communication.
     */
    constructor(connection: DBusConnection) {
        super()
        this.#connection = connection
        this.#connection
            .on('message', (message: DBusMessage): void => {
                switch (message.header.type) {
                    case DBusMessageType.METHOD_RETURN:
                        if (!message.header.replySerial) return
                        if (!this.#inflightCalls[message.header.replySerial]) return
                        return this.#inflightCalls[message.header.replySerial][0](message.body)
                    case DBusMessageType.ERROR:
                        if (!message.header.replySerial) return
                        if (!this.#inflightCalls[message.header.replySerial]) return
                        const error: Error = new Error(message.body[0] ? message.body[0] : '')
                        error.name = message.header.errorName ? message.header.errorName : error.name
                        return this.#inflightCalls[message.header.replySerial][1](error)
                    case DBusMessageType.SIGNAL:
                        const sender: string = message.header.sender
                        const objectPath: string = message.header.path
                        const interfaceName: string = message.header.interfaceName
                        const signalName: string = message.header.member
                        const signalArgs: any[] = message.body
                        const emitResults: boolean[] = []
                        this.#signalEmitters.forEach((emitter: DBusSignalEmitter): void => {
                            emitResults.push(((): boolean => {
                                if (emitter.uniqueName !== '*' && emitter.uniqueName !== sender) return false
                                if (emitter.objectPath !== '*' && emitter.objectPath !== objectPath) return false
                                if (emitter.interface !== '*' && emitter.interface !== interfaceName) return false
                                if (!emitter.eventNames().includes(signalName) && !emitter.eventNames().includes('*')) return false
                                const emitDirectly: boolean = emitter.emit(signalName, ...signalArgs)
                                const emitWildcard: boolean = emitter.emit('*', signalName, ...signalArgs)
                                return emitDirectly || emitWildcard
                            })())
                        })
                        if (emitResults.find((result: boolean): boolean => result)) return
                        const deprecatedSignalRuleStrings: string[] = []
                        this.#signalRulesMap.forEach((signalRuleString: string, rule: Record<string, string>): void => {
                            if (rule.uniqueName !== '*' && rule.uniqueName !== sender) return
                            if (rule.objectPath !== '*' && rule.objectPath !== objectPath) return
                            if (rule.interfaceName !== '*' && rule.interfaceName !== interfaceName) return
                            if (rule.signalName !== '*' && rule.signalName !== signalName) return
                            deprecatedSignalRuleStrings.push(signalRuleString)
                            this.#signalRulesMap.delete(rule)
                        })
                        return deprecatedSignalRuleStrings.forEach((deprecatedSignalRuleString: string): void => this.offSignal(deprecatedSignalRuleString))
                    case DBusMessageType.METHOD_CALL:
                        this.emit('methodCall', message)
                        return
                }
            })
            .on('close', (): boolean => this.emit('connectionClose'))
            .on('error', (error: Error): boolean => this.emit('connectionError', error))
    }

    /**
     * Adds an event listener for various DBus events.
     * Supports events like connection status, name changes, and method calls.
     *
     * @param eventName - The name of the event to listen for.
     * @param listener - The callback function to execute when the event occurs.
     * @returns This instance for method chaining.
     */
    public on(eventName: 'online', listener: (name: string) => void): this
    public on(eventName: 'offline', listener: (name: string) => void): this
    public on(eventName: 'replaced', listener: (name: string) => void): this
    public on(eventName: 'methodCall', listener: (message: DBusMessage) => void): this
    public on(eventName: 'NameOwnerChanged', listener: (name: string, oldOwner: string, newOwner: string) => void): this
    public on(eventName: 'NameLost', listener: (name: string) => void): this
    public on(eventName: 'NameAcquired', listener: (name: string) => void): this
    public on(eventName: 'connectionClose', listener: () => void): this
    public on(eventName: 'connectionError', listener: (error: Error) => void): this
    public on(eventName: string, listener: (...args: any[]) => void): this
    public on(eventName: string, listener: (...args: any[]) => void): this {
        super.on(eventName, listener)
        return this
    }

    /**
     * Adds a one-time event listener for various DBus events.
     *
     * @param eventName - The name of the event to listen for.
     * @param listener - The callback function to execute once when the event occurs.
     * @returns This instance for method chaining.
     */
    public once(eventName: 'online', listener: (name: string) => void): this
    public once(eventName: 'offline', listener: (name: string) => void): this
    public once(eventName: 'replaced', listener: (name: string) => void): this
    public once(eventName: 'methodCall', listener: (message: DBusMessage) => void): this
    public once(eventName: 'NameOwnerChanged', listener: (name: string, oldOwner: string, newOwner: string) => void): this
    public once(eventName: 'NameLost', listener: (name: string) => void): this
    public once(eventName: 'NameAcquired', listener: (name: string) => void): this
    public once(eventName: 'connectionClose', listener: () => void): this
    public once(eventName: 'connectionError', listener: (error: Error) => void): this
    public once(eventName: string, listener: (...args: any[]) => void): this
    public once(eventName: string, listener: (...args: any[]) => void): this {
        super.once(eventName, listener)
        return this
    }

    /**
     * Removes an event listener for various DBus events.
     *
     * @param eventName - The name of the event to remove the listener from.
     * @param listener - The callback function to remove.
     * @returns This instance for method chaining.
     */
    public off(eventName: 'online', listener: (name: string) => void): this
    public off(eventName: 'offline', listener: (name: string) => void): this
    public off(eventName: 'replaced', listener: (name: string) => void): this
    public off(eventName: 'methodCall', listener: (message: DBusMessage) => void): this
    public off(eventName: 'NameOwnerChanged', listener: (name: string, oldOwner: string, newOwner: string) => void): this
    public off(eventName: 'NameLost', listener: (name: string) => void): this
    public off(eventName: 'NameAcquired', listener: (name: string) => void): this
    public off(eventName: 'connectionClose', listener: () => void): this
    public off(eventName: 'connectionError', listener: (error: Error) => void): this
    public off(eventName: string, listener: (...args: any[]) => void): this
    public off(eventName: string, listener: (...args: any[]) => void): this {
        super.off(eventName, listener)
        return this
    }

    /**
     * Removes a specific event listener (alias for `off`).
     *
     * @param eventName - The name of the event to remove the listener from.
     * @param listener - The callback function to remove.
     * @returns This instance for method chaining.
     */
    public removeListener(eventName: 'online', listener: (name: string) => void): this
    public removeListener(eventName: 'offline', listener: (name: string) => void): this
    public removeListener(eventName: 'replaced', listener: (name: string) => void): this
    public removeListener(eventName: 'methodCall', listener: (message: DBusMessage) => void): this
    public removeListener(eventName: 'NameOwnerChanged', listener: (name: string, oldOwner: string, newOwner: string) => void): this
    public removeListener(eventName: 'NameLost', listener: (name: string) => void): this
    public removeListener(eventName: 'NameAcquired', listener: (name: string) => void): this
    public removeListener(eventName: 'connectionClose', listener: () => void): this
    public removeListener(eventName: 'connectionError', listener: (error: Error) => void): this
    public removeListener(eventName: string, listener: (...args: any[]) => void): this
    public removeListener(eventName: string, listener: (...args: any[]) => void): this {
        super.removeListener(eventName, listener)
        return this
    }

    /**
     * Adds a match rule to receive specific signals from the DBus daemon.
     *
     * @param rule - The match rule string to specify which signals to receive.
     */
    public addMatch(rule: string): void {
        this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            method: 'AddMatch',
            signature: 's',
            args: [rule]
        }, true)
    }

    /**
     * Removes a previously added match rule from the DBus daemon.
     *
     * @param rule - The match rule string to remove.
     */
    public removeMatch(rule: string): void {
        this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            method: 'RemoveMatch',
            signature: 's',
            args: [rule]
        }, true)
    }

    /**
     * Retrieves the unique name of the owner of a given bus name.
     *
     * @param name - The bus name to query.
     * @returns A Promise resolving to the unique name of the owner or undefined if not found.
     */
    public async getNameOwner(name: string): Promise<string | undefined> {
        try {
            const [owner] = await this.invoke({
                service: 'org.freedesktop.DBus',
                objectPath: '/org/freedesktop/DBus',
                interface: 'org.freedesktop.DBus',
                method: 'GetNameOwner',
                signature: 's',
                args: [name]
            })
            return owner
        } catch (e) {
            return undefined
        }
    }

    /**
     * Lists all activatable bus names (services that can be started).
     *
     * @returns A Promise resolving to an array of activatable bus names.
     */
    public async listActivatableNames(): Promise<string[]> {
        const [activatableNames] = await this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            method: 'ListActivatableNames'
        })
        return activatableNames
    }

    /**
     * Lists all currently active bus names.
     *
     * @returns A Promise resolving to an array of active bus names.
     */
    public async listNames(): Promise<string[]> {
        const [names] = await this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            method: 'ListNames'
        })
        return names
    }

    /**
     * Checks if a given bus name currently has an owner.
     *
     * @param name - The bus name to check.
     * @returns A Promise resolving to a boolean indicating if the name has an owner.
     */
    public async nameHasOwner(name: string): Promise<boolean> {
        const [hasOwner] = await this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            signature: 's',
            method: 'NameHasOwner',
            args: [name]
        })
        return hasOwner
    }

    /**
     * Requests ownership of a bus name with specified flags.
     *
     * @param name - The bus name to request.
     * @param flags - Optional flags for the request (default: DBUS_NAME_FLAG_DEFAULT).
     * @returns A Promise resolving to the result code of the request.
     */
    public async requestName(name: string, flags: RequestNameFlags = RequestNameFlags.DBUS_NAME_FLAG_DEFAULT): Promise<RequestNameResultCode> {
        const [res] = await this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            signature: 'su',
            method: 'RequestName',
            args: [name, flags]
        })
        return res
    }

    /**
     * Releases ownership of a bus name.
     *
     * @param name - The bus name to release.
     * @returns A Promise resolving to the result code of the release operation.
     */
    public async releaseName(name: string): Promise<number> {
        const [res] = await this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            signature: 's',
            method: 'ReleaseName',
            args: [name]
        })
        return res
    }

    /**
     * Reloads the DBus daemon configuration.
     *
     * @returns A Promise that resolves when the configuration is reloaded.
     */
    public async reloadConfig(): Promise<void> {
        await this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            method: 'ReloadConfig'
        })
    }

    /**
     * Starts a service by its bus name.
     *
     * @param name - The bus name of the service to start.
     * @param flags - Optional flags for starting the service (default: 0).
     * @returns A Promise resolving to the result code of the start operation.
     */
    public async startServiceByName(name: string, flags: number = 0): Promise<number> {
        const [res] = await this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            signature: 'su',
            method: 'StartServiceByName',
            args: [name, flags]
        })
        return res
    }

    /**
     * Retrieves the Unix process ID of a connection by its bus name.
     *
     * @param name - The bus name of the connection.
     * @returns A Promise resolving to the process ID or undefined if not found.
     */
    public async getConnectionUnixProcessID(name: string): Promise<number | undefined> {
        try {
            const [pid] = await this.invoke({
                service: 'org.freedesktop.DBus',
                objectPath: '/org/freedesktop/DBus',
                interface: 'org.freedesktop.DBus',
                method: 'GetConnectionUnixProcessID',
                signature: 's',
                args: [name]
            })
            return pid
        } catch (e) {
            return undefined
        }
    }

    /**
     * Disconnects from the DBus daemon.
     *
     * @returns A Promise that resolves when the connection is closed.
     */
    public async disconnect(): Promise<void> {
        await new Promise<void>(resolve => this.#connection.end(resolve))
    }

    /**
     * Lists all bus names, including active and activatable ones, with detailed information.
     *
     * @returns A Promise resolving to an array of bus name information objects.
     */
    public async listBusNames(): Promise<BusNameBasicInfo[]> {
        const [activeNames, activatableNames] = await Promise.all([
            this.listNames(),
            this.listActivatableNames()
        ])
        const names: string[] = [...new Set([...activeNames, ...activatableNames])]
        return await Promise.all(names.map((name: string): Promise<ServiceBasicInfo> => {
            return new Promise(async (resolve): Promise<void> => {
                const [uniqueName, pid] = await Promise.all([
                    this.getNameOwner(name),
                    this.getConnectionUnixProcessID(name)
                ])
                return resolve({
                    name: name,
                    uniqueName: uniqueName,
                    active: activeNames.includes(name),
                    activatable: activatableNames.includes(name),
                    pid: pid
                })
            })
        }))
    }

    /**
     * Lists all services (bus names that are not unique connection names).
     *
     * @returns A Promise resolving to an array of service information objects.
     */
    public async listServices(): Promise<ServiceBasicInfo[]> {
        const busNameInfos: BusNameBasicInfo[] = await this.listBusNames()
        return busNameInfos.filter((busNameInfo: BusNameBasicInfo): boolean => busNameInfo.name !== busNameInfo.uniqueName)
    }

    /**
     * Retrieves all services as DBusService instances.
     *
     * @returns A Promise resolving to an array of DBusService instances.
     */
    public async getServices(): Promise<DBusService[]> {
        const serviceBasicInfos: ServiceBasicInfo[] = await this.listServices()
        return Promise.all(serviceBasicInfos.map((serviceBasicInfo: ServiceBasicInfo): Promise<DBusService> => this.getService(serviceBasicInfo.name)))
    }

    /**
     * Retrieves a specific service by its bus name.
     * Starts the service if it is activatable but not active.
     *
     * @param service - The bus name of the service to retrieve.
     * @returns A Promise resolving to a DBusService instance.
     * @throws {ServiceNotFoundError} If the service is not found or has no connection.
     */
    public async getService(service: string): Promise<DBusService> {
        const [activeNames, activatableNames] = await Promise.all([
            this.listNames(),
            this.listActivatableNames()
        ])
        if (!activeNames.includes(service) && !activatableNames.includes(service)) throw new ServiceNotFoundError(`Service ${service} not found`)
        if (activatableNames.includes(service) && !activeNames.includes(service)) await this.startServiceByName(service)
        const uniqueName: string | undefined = await this.getNameOwner(service)
        if (!uniqueName) throw new ServiceNotFoundError(`Service ${service} has not connection`)
        const dbusService: DBusService = new DBusService({dbus: this, service: service, uniqueName: uniqueName})
        this.#weakServiceSet.add(new WeakRef(dbusService))
        return dbusService
    }

    /**
     * Retrieves a specific DBus object by service and object path.
     *
     * @param service - The bus name of the service.
     * @param objectPath - The object path to retrieve.
     * @returns A Promise resolving to a DBusObject instance.
     */
    public async getObject(service: string, objectPath: string): Promise<DBusObject> {
        return (await this.getService(service)).getObject(objectPath)
    }

    /**
     * Retrieves a specific DBus interface by service, object path, and interface name.
     *
     * @param service - The bus name of the service.
     * @param objectPath - The object path of the object.
     * @param iface - The interface name to retrieve.
     * @returns A Promise resolving to a DBusInterface instance.
     */
    public async getInterface(service: string, objectPath: string, iface: string): Promise<DBusInterface> {
        return (await this.getObject(service, objectPath)).getInterface(iface)
    }
}
