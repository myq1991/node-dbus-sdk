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
     * @returns The unique name assigned by the DBus daemon (e.g., ':1.123').
     */
    public get uniqueName(): string {
        return this.#uniqueName
    }

    /**
     * Static method to connect to a DBus instance.
     * Creates a new DBus connection with the provided options and initializes it.
     *
     * @param opts - Connection options (e.g., socket path, TCP details, or stream settings).
     * @returns A Promise resolving to an initialized DBus instance ready for use.
     */
    public static async connect(opts: ConnectOpts): Promise<DBus> {
        const bus: DBus = new DBus(await DBusConnection.createConnection(opts))
        return await bus.initialize()
    }

    /**
     * Initializes the DBus connection.
     * Performs a 'Hello' call to obtain a unique name, sets up the management interface,
     * updates services and signal emitters with current name owners, and registers
     * event listeners for DBus daemon signals.
     *
     * @returns A Promise resolving to this DBus instance after initialization is complete.
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
     * This is typically the first step in DBus connection initialization.
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
     * Used internally to send encoded DBus messages to the daemon.
     *
     * @param data - The Buffer containing the data to write to the DBus socket.
     * @throws {Error} If the DBus connection is disconnected, with a specific DBus error code.
     */
    public write(data: Buffer): void {
        if (!this.#connection.connected) throw CreateDBusError('org.freedesktop.DBus.Error.Disconnected', 'DBus disconnected')
        this.#connection.write(data)
    }

    /**
     * Emits a DBus signal with the specified options.
     * Encodes the signal message using the provided options and writes it to the DBus socket.
     * Signals are broadcast messages that do not expect a reply.
     *
     * @param opts - Options for emitting the signal, including object path, interface, signal name, destination, signature, and data.
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
     * Handles both successful responses (METHOD_RETURN) and error replies (ERROR).
     * Encodes the reply message and writes it to the DBus socket.
     *
     * @param opts - Options for the reply, including reply serial number, destination, signature, and data or error object.
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
     * Invokes a DBus method call with the specified options, without expecting a reply.
     * Sends the method call message to the DBus daemon and does not wait for a response.
     *
     * @param opts - Options for the method call, including service, object path, interface, method, signature, and arguments.
     * @param noReply - Set to true to indicate no reply is expected.
     * @returns void as no response is expected or processed.
     */
    public invoke(opts: InvokeOpts, noReply: true): void
    /**
     * Invokes a DBus method call with the specified options, explicitly expecting a reply.
     * Sends the method call message to the DBus daemon and waits for a response or error.
     *
     * @param opts - Options for the method call, including service, object path, interface, method, signature, and arguments.
     * @param noReply - Set to false to indicate a reply is expected.
     * @returns A Promise resolving to an array of response data from the method call.
     */
    public async invoke(opts: InvokeOpts, noReply: false): Promise<any[]>
    /**
     * Invokes a DBus method call with the specified options, defaulting to expecting a reply.
     * Sends the method call message to the DBus daemon and waits for a response or error.
     *
     * @param opts - Options for the method call, including service, object path, interface, method, signature, and arguments.
     * @returns A Promise resolving to an array of response data from the method call.
     */
    public async invoke(opts: InvokeOpts): Promise<any[]>
    /**
     * Invokes a DBus method call with the specified options, with a configurable reply expectation.
     * Sends the method call message to the DBus daemon and optionally waits for a response.
     * This is the implementation signature that handles the logic for all overloads.
     *
     * @param opts - Options for the method call, including service, object path, interface, method, signature, and arguments.
     * @param noReply - Boolean indicating if a reply is expected (default: false, meaning a reply is expected).
     * @returns A Promise resolving to the response data if a reply is expected, otherwise void.
     */
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
     * Calls the 'Get' method of 'org.freedesktop.DBus.Properties' to fetch a property value.
     *
     * @param opts - Options for getting the property, including service, object path, interface name, and property name.
     * @returns A Promise resolving to the value of the requested property.
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
     * Calls the 'Set' method of 'org.freedesktop.DBus.Properties' to update a property value.
     *
     * @param opts - Options for setting the property, including service, object path, interface name, property name, value, and optional signature.
     * @returns A Promise that resolves when the property is successfully set.
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
     * Constructs a rule string to filter incoming signals based on sender, path, interface, and signal name.
     *
     * @param uniqueName - The sender's unique name or '*' to match any sender.
     * @param objectPath - The object path or '*' to match any path.
     * @param interfaceName - The interface name or '*' to match any interface.
     * @param signalName - The signal name or '*' to match any signal.
     * @returns The formatted match rule string (e.g., 'type=signal,sender=:1.123,interface=org.test').
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
     * Adds a match rule to receive signals matching the specified criteria and stores it for management.
     *
     * @param uniqueName - The sender's unique name or '*' to match any sender.
     * @param objectPath - The object path or '*' to match any path.
     * @param interfaceName - The interface name or '*' to match any interface.
     * @param signalName - The signal name or '*' to match any signal.
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
     * Removes a previously added match rule to stop receiving specific signals.
     *
     * @param signalRuleString - The formatted rule string to remove from the DBus daemon.
     */
    protected offSignal(signalRuleString: string): void {
        return this.removeMatch(signalRuleString)
    }

    /**
     * Creates a signal emitter for listening to DBus signals.
     * Constructs a DBusSignalEmitter instance to handle signal events for specific criteria.
     *
     * @param opts - Options for creating the signal emitter, including service name, object path, and interface.
     * @returns A DBusSignalEmitter instance for subscribing to and handling signals.
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
     * Initializes the DBus instance with a connection and sets up event listeners for
     * incoming messages, connection closure, and errors. Dispatches signals to emitters.
     *
     * @param connection - The DBusConnection instance to use for low-level communication.
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
     * Supports a range of predefined events related to service status, name ownership,
     * method calls, and connection state, with type-safe callback signatures.
     *
     * @param eventName - The name of the event to listen for. Specific event names have predefined
     *                    callback signatures for type safety.
     * @param listener - The callback function to execute when the event occurs. The signature of the
     *                   callback depends on the event name.
     * @returns This instance for method chaining.
     *
     * @example
     * dbus.on('online', (name) => console.log(`Service ${name} is online`));
     * dbus.on('methodCall', (message) => console.log('Method call received:', message));
     * dbus.on('connectionError', (error) => console.error('Connection error:', error));
     */
    public on(eventName: 'online', listener: (name: string) => void): this
    /**
     * Adds an event listener for the 'offline' event, emitted when a service goes offline.
     *
     * @param eventName - The string 'offline', indicating a service disconnection event.
     * @param listener - A callback function that receives the service name as an argument, invoked when a service goes offline.
     * @returns This instance for method chaining.
     */
    public on(eventName: 'offline', listener: (name: string) => void): this
    /**
     * Adds an event listener for the 'replaced' event, emitted when a service owner is replaced.
     *
     * @param eventName - The string 'replaced', indicating a service ownership replacement event.
     * @param listener - A callback function that receives the service name as an argument, invoked when a service owner changes.
     * @returns This instance for method chaining.
     */
    public on(eventName: 'replaced', listener: (name: string) => void): this
    /**
     * Adds an event listener for the 'methodCall' event, emitted when a method call is received.
     *
     * @param eventName - The string 'methodCall', indicating an incoming method call event.
     * @param listener - A callback function that receives a DBusMessage object as an argument, invoked on incoming method calls.
     * @returns This instance for method chaining.
     */
    public on(eventName: 'methodCall', listener: (message: DBusMessage) => void): this
    /**
     * Adds an event listener for the 'NameOwnerChanged' event, emitted when a bus name owner changes.
     *
     * @param eventName - The string 'NameOwnerChanged', indicating a bus name ownership change event.
     * @param listener - A callback function that receives the bus name, old owner, and new owner as arguments, invoked on ownership change.
     * @returns This instance for method chaining.
     */
    public on(eventName: 'NameOwnerChanged', listener: (name: string, oldOwner: string, newOwner: string) => void): this
    /**
     * Adds an event listener for the 'NameLost' event, emitted when a bus name is lost by this connection.
     *
     * @param eventName - The string 'NameLost', indicating a bus name loss event.
     * @param listener - A callback function that receives the bus name as an argument, invoked when a name is lost.
     * @returns This instance for method chaining.
     */
    public on(eventName: 'NameLost', listener: (name: string) => void): this
    /**
     * Adds an event listener for the 'NameAcquired' event, emitted when a bus name is acquired by this connection.
     *
     * @param eventName - The string 'NameAcquired', indicating a bus name acquisition event.
     * @param listener - A callback function that receives the bus name as an argument, invoked when a name is acquired.
     * @returns This instance for method chaining.
     */
    public on(eventName: 'NameAcquired', listener: (name: string) => void): this
    /**
     * Adds an event listener for the 'connectionClose' event, emitted when the DBus connection is closed.
     *
     * @param eventName - The string 'connectionClose', indicating a connection closure event.
     * @param listener - A callback function with no arguments, invoked when the connection closes.
     * @returns This instance for method chaining.
     */
    public on(eventName: 'connectionClose', listener: () => void): this
    /**
     * Adds an event listener for the 'connectionError' event, emitted when an error occurs on the DBus connection.
     *
     * @param eventName - The string 'connectionError', indicating a connection error event.
     * @param listener - A callback function that receives an Error object as its argument, invoked when an error occurs.
     * @returns This instance for method chaining.
     */
    public on(eventName: 'connectionError', listener: (error: Error) => void): this
    /**
     * Adds an event listener for a generic or custom event name as a string.
     * This overload allows for flexibility with event names not predefined in the class.
     *
     * @param eventName - A string representing any custom or non-predefined event name.
     * @param listener - A callback function accepting variable arguments, used for handling custom events.
     * @returns This instance for method chaining.
     */
    public on(eventName: string, listener: (...args: any[]) => void): this
    /**
     * Fallback overload for the 'on' method to ensure compatibility with the base EventEmitter class.
     * This is a catch-all signature for any event name and listener combination.
     *
     * @param eventName - Any string representing an event name.
     * @param listener - Any callback function with variable arguments.
     * @returns This instance for method chaining.
     */
    public on(eventName: string, listener: (...args: any[]) => void): this {
        super.on(eventName, listener)
        return this
    }

    /**
     * Adds a one-time event listener for various DBus events.
     * The listener is executed only once when the specified event occurs and is then removed.
     * Supports a range of predefined events with type-safe callback signatures.
     *
     * @param eventName - The name of the event to listen for. Specific event names have predefined
     *                    callback signatures for type safety.
     * @param listener - The callback function to execute once when the event occurs. The signature of
     *                   the callback depends on the event name.
     * @returns This instance for method chaining.
     *
     * @example
     * dbus.once('online', (name) => console.log(`Service ${name} is online`));
     * dbus.once('methodCall', (message) => console.log('First method call:', message));
     * dbus.once('connectionError', (error) => console.error('First error:', error));
     */
    public once(eventName: 'online', listener: (name: string) => void): this
    /**
     * Adds a one-time event listener for the 'offline' event, emitted when a service goes offline.
     *
     * @param eventName - The string 'offline', indicating a service disconnection event.
     * @param listener - A callback function that receives the service name as an argument, invoked once when a service goes offline.
     * @returns This instance for method chaining.
     */
    public once(eventName: 'offline', listener: (name: string) => void): this
    /**
     * Adds a one-time event listener for the 'replaced' event, emitted when a service owner is replaced.
     *
     * @param eventName - The string 'replaced', indicating a service ownership replacement event.
     * @param listener - A callback function that receives the service name as an argument, invoked once when a service owner changes.
     * @returns This instance for method chaining.
     */
    public once(eventName: 'replaced', listener: (name: string) => void): this
    /**
     * Adds a one-time event listener for the 'methodCall' event, emitted when a method call is received.
     *
     * @param eventName - The string 'methodCall', indicating an incoming method call event.
     * @param listener - A callback function that receives a DBusMessage object as an argument, invoked once on an incoming method call.
     * @returns This instance for method chaining.
     */
    public once(eventName: 'methodCall', listener: (message: DBusMessage) => void): this
    /**
     * Adds a one-time event listener for the 'NameOwnerChanged' event, emitted when a bus name owner changes.
     *
     * @param eventName - The string 'NameOwnerChanged', indicating a bus name ownership change event.
     * @param listener - A callback function that receives the bus name, old owner, and new owner as arguments, invoked once on ownership change.
     * @returns This instance for method chaining.
     */
    public once(eventName: 'NameOwnerChanged', listener: (name: string, oldOwner: string, newOwner: string) => void): this
    /**
     * Adds a one-time event listener for the 'NameLost' event, emitted when a bus name is lost by this connection.
     *
     * @param eventName - The string 'NameLost', indicating a bus name loss event.
     * @param listener - A callback function that receives the bus name as an argument, invoked once when a name is lost.
     * @returns This instance for method chaining.
     */
    public once(eventName: 'NameLost', listener: (name: string) => void): this
    /**
     * Adds a one-time event listener for the 'NameAcquired' event, emitted when a bus name is acquired by this connection.
     *
     * @param eventName - The string 'NameAcquired', indicating a bus name acquisition event.
     * @param listener - A callback function that receives the bus name as an argument, invoked once when a name is acquired.
     * @returns This instance for method chaining.
     */
    public once(eventName: 'NameAcquired', listener: (name: string) => void): this
    /**
     * Adds a one-time event listener for the 'connectionClose' event, emitted when the DBus connection is closed.
     *
     * @param eventName - The string 'connectionClose', indicating a connection closure event.
     * @param listener - A callback function with no arguments, invoked once when the connection closes.
     * @returns This instance for method chaining.
     */
    public once(eventName: 'connectionClose', listener: () => void): this
    /**
     * Adds a one-time event listener for the 'connectionError' event, emitted when an error occurs on the DBus connection.
     *
     * @param eventName - The string 'connectionError', indicating a connection error event.
     * @param listener - A callback function that receives an Error object as its argument, invoked once when an error occurs.
     * @returns This instance for method chaining.
     */
    public once(eventName: 'connectionError', listener: (error: Error) => void): this
    /**
     * Adds a one-time event listener for a generic or custom event name as a string.
     * This overload allows for flexibility with event names not predefined in the class.
     *
     * @param eventName - A string representing any custom or non-predefined event name.
     * @param listener - A callback function accepting variable arguments, used for handling custom events once.
     * @returns This instance for method chaining.
     */
    public once(eventName: string, listener: (...args: any[]) => void): this
    /**
     * Fallback overload for the 'once' method to ensure compatibility with the base EventEmitter class.
     * This is a catch-all signature for any event name and listener combination.
     *
     * @param eventName - Any string representing an event name.
     * @param listener - Any callback function with variable arguments.
     * @returns This instance for method chaining.
     */
    public once(eventName: string, listener: (...args: any[]) => void): this {
        super.once(eventName, listener)
        return this
    }

    /**
     * Removes an event listener for various DBus events.
     * Removes a previously registered callback for a specific event type.
     * Supports a range of predefined events with type-safe callback signatures.
     *
     * @param eventName - The name of the event to remove the listener from. Specific event names have predefined
     *                    callback signatures for type safety.
     * @param listener - The callback function to remove from the event listeners.
     * @returns This instance for method chaining.
     *
     * @example
     * const handler = (name) => console.log(`Service ${name} is online`);
     * dbus.on('online', handler);
     * dbus.off('online', handler); // Removes the handler
     */
    public off(eventName: 'online', listener: (name: string) => void): this
    /**
     * Removes an event listener for the 'offline' event, related to a service going offline.
     *
     * @param eventName - The string 'offline', indicating a service disconnection event.
     * @param listener - The callback function to remove, which receives the service name as an argument.
     * @returns This instance for method chaining.
     */
    public off(eventName: 'offline', listener: (name: string) => void): this
    /**
     * Removes an event listener for the 'replaced' event, related to a service owner being replaced.
     *
     * @param eventName - The string 'replaced', indicating a service ownership replacement event.
     * @param listener - The callback function to remove, which receives the service name as an argument.
     * @returns This instance for method chaining.
     */
    public off(eventName: 'replaced', listener: (name: string) => void): this
    /**
     * Removes an event listener for the 'methodCall' event, related to incoming method calls.
     *
     * @param eventName - The string 'methodCall', indicating an incoming method call event.
     * @param listener - The callback function to remove, which receives a DBusMessage object as an argument.
     * @returns This instance for method chaining.
     */
    public off(eventName: 'methodCall', listener: (message: DBusMessage) => void): this
    /**
     * Removes an event listener for the 'NameOwnerChanged' event, related to bus name owner changes.
     *
     * @param eventName - The string 'NameOwnerChanged', indicating a bus name ownership change event.
     * @param listener - The callback function to remove, which receives the bus name, old owner, and new owner as arguments.
     * @returns This instance for method chaining.
     */
    public off(eventName: 'NameOwnerChanged', listener: (name: string, oldOwner: string, newOwner: string) => void): this
    /**
     * Removes an event listener for the 'NameLost' event, related to losing a bus name.
     *
     * @param eventName - The string 'NameLost', indicating a bus name loss event.
     * @param listener - The callback function to remove, which receives the bus name as an argument.
     * @returns This instance for method chaining.
     */
    public off(eventName: 'NameLost', listener: (name: string) => void): this
    /**
     * Removes an event listener for the 'NameAcquired' event, related to acquiring a bus name.
     *
     * @param eventName - The string 'NameAcquired', indicating a bus name acquisition event.
     * @param listener - The callback function to remove, which receives the bus name as an argument.
     * @returns This instance for method chaining.
     */
    public off(eventName: 'NameAcquired', listener: (name: string) => void): this
    /**
     * Removes an event listener for the 'connectionClose' event, related to DBus connection closure.
     *
     * @param eventName - The string 'connectionClose', indicating a connection closure event.
     * @param listener - The callback function to remove, which has no arguments.
     * @returns This instance for method chaining.
     */
    public off(eventName: 'connectionClose', listener: () => void): this
    /**
     * Removes an event listener for the 'connectionError' event, related to DBus connection errors.
     *
     * @param eventName - The string 'connectionError', indicating a connection error event.
     * @param listener - The callback function to remove, which receives an Error object as an argument.
     * @returns This instance for method chaining.
     */
    public off(eventName: 'connectionError', listener: (error: Error) => void): this
    /**
     * Removes an event listener for a generic or custom event name as a string.
     * This overload allows for flexibility with event names not predefined in the class.
     *
     * @param eventName - A string representing any custom or non-predefined event name.
     * @param listener - The callback function to remove, accepting variable arguments for custom events.
     * @returns This instance for method chaining.
     */
    public off(eventName: string, listener: (...args: any[]) => void): this
    /**
     * Fallback overload for the 'off' method to ensure compatibility with the base EventEmitter class.
     * This is a catch-all signature for any event name and listener combination.
     *
     * @param eventName - Any string representing an event name.
     * @param listener - Any callback function with variable arguments.
     * @returns This instance for method chaining.
     */
    public off(eventName: string, listener: (...args: any[]) => void): this {
        super.off(eventName, listener)
        return this
    }

    /**
     * Removes a specific event listener (alias for `off`).
     * Removes a previously registered callback for a specific event type.
     * Supports a range of predefined events with type-safe callback signatures.
     *
     * @param eventName - The name of the event to remove the listener from. Specific event names have predefined
     *                    callback signatures for type safety.
     * @param listener - The callback function to remove from the event listeners.
     * @returns This instance for method chaining.
     *
     * @example
     * const handler = (name) => console.log(`Service ${name} is online`);
     * dbus.on('online', handler);
     * dbus.removeListener('online', handler); // Removes the handler
     */
    public removeListener(eventName: 'online', listener: (name: string) => void): this
    /**
     * Removes an event listener for the 'offline' event, related to a service going offline.
     *
     * @param eventName - The string 'offline', indicating a service disconnection event.
     * @param listener - The callback function to remove, which receives the service name as an argument.
     * @returns This instance for method chaining.
     */
    public removeListener(eventName: 'offline', listener: (name: string) => void): this
    /**
     * Removes an event listener for the 'replaced' event, related to a service owner being replaced.
     *
     * @param eventName - The string 'replaced', indicating a service ownership replacement event.
     * @param listener - The callback function to remove, which receives the service name as an argument.
     * @returns This instance for method chaining.
     */
    public removeListener(eventName: 'replaced', listener: (name: string) => void): this
    /**
     * Removes an event listener for the 'methodCall' event, related to incoming method calls.
     *
     * @param eventName - The string 'methodCall', indicating an incoming method call event.
     * @param listener - The callback function to remove, which receives a DBusMessage object as an argument.
     * @returns This instance for method chaining.
     */
    public removeListener(eventName: 'methodCall', listener: (message: DBusMessage) => void): this
    /**
     * Removes an event listener for the 'NameOwnerChanged' event, related to bus name owner changes.
     *
     * @param eventName - The string 'NameOwnerChanged', indicating a bus name ownership change event.
     * @param listener - The callback function to remove, which receives the bus name, old owner, and new owner as arguments.
     * @returns This instance for method chaining.
     */
    public removeListener(eventName: 'NameOwnerChanged', listener: (name: string, oldOwner: string, newOwner: string) => void): this
    /**
     * Removes an event listener for the 'NameLost' event, related to losing a bus name.
     *
     * @param eventName - The string 'NameLost', indicating a bus name loss event.
     * @param listener - The callback function to remove, which receives the bus name as an argument.
     * @returns This instance for method chaining.
     */
    public removeListener(eventName: 'NameLost', listener: (name: string) => void): this
    /**
     * Removes an event listener for the 'NameAcquired' event, related to acquiring a bus name.
     *
     * @param eventName - The string 'NameAcquired', indicating a bus name acquisition event.
     * @param listener - The callback function to remove, which receives the bus name as an argument.
     * @returns This instance for method chaining.
     */
    public removeListener(eventName: 'NameAcquired', listener: (name: string) => void): this
    /**
     * Removes an event listener for the 'connectionClose' event, related to DBus connection closure.
     *
     * @param eventName - The string 'connectionClose', indicating a connection closure event.
     * @param listener - The callback function to remove, which has no arguments.
     * @returns This instance for method chaining.
     */
    public removeListener(eventName: 'connectionClose', listener: () => void): this
    /**
     * Removes an event listener for the 'connectionError' event, related to DBus connection errors.
     *
     * @param eventName - The string 'connectionError', indicating a connection error event.
     * @param listener - The callback function to remove, which receives an Error object as an argument.
     * @returns This instance for method chaining.
     */
    public removeListener(eventName: 'connectionError', listener: (error: Error) => void): this
    /**
     * Removes an event listener for a generic or custom event name as a string.
     * This overload allows for flexibility with event names not predefined in the class.
     *
     * @param eventName - A string representing any custom or non-predefined event name.
     * @param listener - The callback function to remove, accepting variable arguments for custom events.
     * @returns This instance for method chaining.
     */
    public removeListener(eventName: string, listener: (...args: any[]) => void): this
    /**
     * Fallback overload for the 'removeListener' method to ensure compatibility with the base EventEmitter class.
     * This is a catch-all signature for any event name and listener combination.
     *
     * @param eventName - Any string representing an event name.
     * @param listener - Any callback function with variable arguments.
     * @returns This instance for method chaining.
     */
    public removeListener(eventName: string, listener: (...args: any[]) => void): this {
        super.removeListener(eventName, listener)
        return this
    }

    /**
     * Adds a match rule to receive specific signals from the DBus daemon.
     * Sends a method call to the DBus daemon to register the rule without waiting for a reply.
     *
     * @param rule - The match rule string specifying which signals to receive (e.g., 'type=signal,interface=org.test').
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
     * Sends a method call to the DBus daemon to unregister the rule without waiting for a reply.
     *
     * @param rule - The match rule string to remove, previously added with addMatch.
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
     * Queries the DBus daemon to get the current owner of a well-known bus name.
     *
     * @param name - The bus name to query (e.g., 'org.freedesktop.DBus').
     * @returns A Promise resolving to the unique name of the owner (e.g., ':1.123') or undefined if not found or an error occurs.
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
     * Retrieves a list of service names that are registered as activatable with the DBus daemon.
     *
     * @returns A Promise resolving to an array of activatable bus names (e.g., ['org.test.Service']).
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
     * Retrieves a list of service names that are currently active (have an owner) on the bus.
     *
     * @returns A Promise resolving to an array of active bus names (e.g., ['org.test.Service', ':1.123']).
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
     * Queries the DBus daemon to determine if a specific bus name is currently owned by a connection.
     *
     * @param name - The bus name to check (e.g., 'org.test.Service').
     * @returns A Promise resolving to a boolean indicating if the name has an owner (true) or not (false).
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
     * Attempts to acquire a well-known bus name for this connection, with options for behavior on conflict.
     *
     * @param name - The bus name to request (e.g., 'org.my.Service').
     * @param flags - Optional flags for the request behavior (default: RequestNameFlags.DBUS_NAME_FLAG_DEFAULT).
     * @returns A Promise resolving to a result code indicating success or the reason for failure (e.g., RequestNameResultCode.DBUS_REQUEST_NAME_REPLY_PRIMARY_OWNER).
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
     * Releases a previously acquired well-known bus name, allowing others to claim it.
     *
     * @param name - The bus name to release (e.g., 'org.my.Service').
     * @returns A Promise resolving to a numeric result code indicating the outcome of the release operation.
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
     * Requests the DBus daemon to reload its configuration files, typically for administrative purposes.
     *
     * @returns A Promise that resolves when the configuration reload request is sent and processed.
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
     * Requests the DBus daemon to activate a service if it is activatable and not currently running.
     *
     * @param name - The bus name of the service to start (e.g., 'org.my.Service').
     * @param flags - Optional flags for starting the service (default: 0, no specific flags).
     * @returns A Promise resolving to a numeric result code indicating the outcome of the start operation.
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
     * Queries the DBus daemon to get the PID of the process owning a specific bus name.
     *
     * @param name - The bus name of the connection (e.g., 'org.my.Service' or ':1.123').
     * @returns A Promise resolving to the process ID as a number, or undefined if not found or an error occurs.
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
     * Closes the underlying connection stream, ending communication with the daemon.
     *
     * @returns A Promise that resolves when the connection is fully closed.
     */
    public async disconnect(): Promise<void> {
        await new Promise<void>(resolve => this.#connection.end(resolve))
    }

    /**
     * Lists all bus names, including active and activatable ones, with detailed information.
     * Combines active and activatable names, fetching additional details like owner and PID.
     *
     * @returns A Promise resolving to an array of bus name information objects, including name, unique name, active status, activatable status, and PID.
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
     * Filters out unique connection names (e.g., ':1.123') to return only well-known service names.
     *
     * @returns A Promise resolving to an array of service information objects, excluding unique connection names.
     */
    public async listServices(): Promise<ServiceBasicInfo[]> {
        const busNameInfos: BusNameBasicInfo[] = await this.listBusNames()
        return busNameInfos.filter((busNameInfo: BusNameBasicInfo): boolean => busNameInfo.name !== busNameInfo.uniqueName)
    }

    /**
     * Retrieves all services as DBusService instances.
     * Converts the list of service information into instantiated DBusService objects for interaction.
     *
     * @returns A Promise resolving to an array of DBusService instances representing all available services.
     */
    public async getServices(): Promise<DBusService[]> {
        const serviceBasicInfos: ServiceBasicInfo[] = await this.listServices()
        return Promise.all(serviceBasicInfos.map((serviceBasicInfo: ServiceBasicInfo): Promise<DBusService> => this.getService(serviceBasicInfo.name)))
    }

    /**
     * Retrieves a specific service by its bus name.
     * Starts the service if it is activatable but not currently active, and throws an error if not found.
     *
     * @param service - The bus name of the service to retrieve (e.g., 'org.my.Service').
     * @returns A Promise resolving to a DBusService instance for the specified service.
     * @throws {ServiceNotFoundError} If the service is not found in active or activatable lists, or if it has no connection.
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
     * Fetches the service first, then constructs or retrieves the object at the specified path.
     *
     * @param service - The bus name of the service (e.g., 'org.my.Service').
     * @param objectPath - The object path to retrieve (e.g., '/org/my/Object').
     * @returns A Promise resolving to a DBusObject instance for the specified path under the service.
     */
    public async getObject(service: string, objectPath: string): Promise<DBusObject> {
        return (await this.getService(service)).getObject(objectPath)
    }

    /**
     * Retrieves a specific DBus interface by service, object path, and interface name.
     * Fetches the object first, then retrieves or constructs the specified interface on that object.
     *
     * @param service - The bus name of the service (e.g., 'org.my.Service').
     * @param objectPath - The object path of the object (e.g., '/org/my/Object').
     * @param iface - The interface name to retrieve (e.g., 'org.my.Interface').
     * @returns A Promise resolving to a DBusInterface instance for the specified interface.
     */
    public async getInterface(service: string, objectPath: string, iface: string): Promise<DBusInterface> {
        return (await this.getObject(service, objectPath)).getInterface(iface)
    }
}
