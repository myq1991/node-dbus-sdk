import EventEmitter from 'node:events'
import {CreateSignalEmitterOpts} from '../types/CreateSignalEmitterOpts'

/**
 * A class that extends Node.js EventEmitter to handle DBus signal emissions.
 * Manages signal listeners and emitters for a specific DBus service, object path, and interface.
 * Supports wildcard '*' for unique name, object path, and interface to handle multiple sources.
 *
 * Each signal name with listeners holds one match rule on the bus: it is added with the first listener and
 * removed with the last one (including once listeners after they fired).
 */
export class DBusSignalEmitter extends EventEmitter {

    /**
     * A set of all DBusSignalEmitter instances.
     * Used to track active signal emitters and manage their lifecycle.
     */
    readonly #signalEmitters: Set<DBusSignalEmitter>

    /**
     * The unique name of the DBus connection or service (e.g., ':1.123') or '*' for any.
     * Represents the specific connection or a wildcard to match any connection.
     */
    #uniqueName: string | '*'

    /**
     * The object path on the DBus (e.g., '/org/freedesktop/DBus') or '*' for any.
     * Represents the specific object path or a wildcard to match any path.
     */
    readonly #objectPath: string | '*'

    /**
     * The DBus interface name (e.g., 'org.freedesktop.DBus.Properties') or '*' for any.
     * Represents the specific interface or a wildcard to match any interface.
     */
    readonly #interface: string | '*'

    /**
     * The match rule registered for each signal name that has listeners ('' when the handler returned none).
     */
    readonly #rules: Map<string, string> = new Map()

    /**
     * Registers a match rule with the bus for a signal name and returns it.
     */
    protected readonly onSignalHandler: (service: string | '*', objectPath: string | '*', interfaceName: string | '*', signalName: string | '*') => string | void

    /**
     * Withdraws a match rule returned by onSignalHandler.
     */
    protected readonly offSignalHandler?: (signalRuleString: string) => void

    /**
     * The service name associated with this emitter.
     */
    public readonly service: string

    /**
     * Getter for the unique name of the DBus connection or wildcard '*'.
     *
     * @returns The unique name or '*' if wildcard is used.
     */
    public get uniqueName(): string | '*' {
        return this.#uniqueName
    }

    /**
     * Getter for the object path or wildcard '*'.
     *
     * @returns The object path or '*' if wildcard is used.
     */
    public get objectPath(): string | '*' {
        return this.#objectPath
    }

    /**
     * Getter for the interface name or wildcard '*'.
     *
     * @returns The interface name or '*' if wildcard is used.
     */
    public get interface(): string | '*' {
        return this.#interface
    }

    /**
     * Constructor for DBusSignalEmitter.
     * Initializes the emitter with options and handlers that add and remove match rules on the bus.
     *
     * @param opts - Options for creating the signal emitter, including uniqueName, objectPath, and interface.
     * @param signalEmitters - A set of all DBusSignalEmitter instances to manage active emitters.
     * @param onSignalHandler - Called to add the match rule for a signal name; returns the rule.
     * @param offSignalHandler - Called with a rule returned by onSignalHandler once nothing listens to that signal.
     */
    constructor(opts: CreateSignalEmitterOpts, signalEmitters: Set<DBusSignalEmitter>, onSignalHandler: (service: string | '*', objectPath: string | '*', interfaceName: string | '*', signalName: string | '*') => string | void, offSignalHandler?: (signalRuleString: string) => void) {
        super()
        this.#signalEmitters = signalEmitters
        this.onSignalHandler = onSignalHandler
        this.offSignalHandler = offSignalHandler
        this.service = opts.service
        this.#uniqueName = opts.uniqueName
        this.#objectPath = opts.objectPath
        this.#interface = opts.interface
    }

    /**
     * Updates the unique name of the emitter if it is not set to wildcard '*'.
     * Replaces the match rule of every subscribed signal with one for the new sender.
     *
     * @param newUniqueName - The new unique name to set for this emitter.
     */
    protected updateUniqueName(newUniqueName: string): void {
        if (this.uniqueName === '*') return
        this.#uniqueName = newUniqueName
        for (const eventName of [...this.#rules.keys()]) {
            this.unsubscribe(eventName)
            this.subscribe(eventName)
        }
    }

    /**
     * Adds the match rule for a signal name unless it already has one.
     */
    protected subscribe(eventName: string): void {
        if (this.#rules.has(eventName)) return
        const rule: string | void = this.onSignalHandler(this.uniqueName, this.objectPath, this.interface, eventName)
        this.#rules.set(eventName, typeof rule === 'string' ? rule : '')
    }

    /**
     * Removes the match rule for a signal name.
     */
    protected unsubscribe(eventName: string): void {
        const rule: string | undefined = this.#rules.get(eventName)
        if (rule === undefined) return
        this.#rules.delete(eventName)
        if (rule && this.offSignalHandler) this.offSignalHandler(rule)
    }

    /**
     * Removes the match rule of a signal name that has no listeners left.
     */
    protected unsubscribeIfUnused(eventName: string): void {
        if (!super.listenerCount(eventName)) this.unsubscribe(eventName)
    }

    /**
     * Updates the set of signal emitters based on whether this emitter has active events.
     * Removes this emitter from the set if no events are registered, or adds it if events exist.
     */
    protected updateSignalEmitters(): void {
        if (!this.eventNames().length) {
            if (this.#signalEmitters.has(this)) this.#signalEmitters.delete(this)
        } else {
            if (!this.#signalEmitters.has(this)) this.#signalEmitters.add(this)
        }
    }

    /**
     * Adds a listener for the specified event (signal name), subscribing to the signal if needed.
     *
     * @param eventName - The name of the event (signal) to listen for.
     * @param listener - The callback function to execute when the event is emitted.
     * @returns This instance for method chaining.
     */
    public addListener(eventName: string, listener: (...args: any[]) => void): this {
        this.subscribe(eventName)
        super.addListener(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    /**
     * Emits an event with the specified name and arguments.
     *
     * @param eventName - The name of the event (signal) to emit.
     * @param args - The arguments to pass to the event listeners.
     * @returns True if the event had listeners, false otherwise.
     */
    public emit(eventName: string, ...args: any[]): boolean {
        const emitResult: boolean = super.emit(eventName, ...args)
        this.updateSignalEmitters()
        return emitResult
    }

    /**
     * Returns an array of event names for which listeners are registered.
     *
     * @returns An array of event names (signal names) as strings.
     */
    public eventNames(): string[] {
        return super.eventNames() as string[]
    }

    /**
     * Gets the maximum number of listeners allowed for any event.
     *
     * @returns The maximum number of listeners.
     */
    public getMaxListeners(): number {
        return super.getMaxListeners()
    }

    /**
     * Returns the number of listeners for a specific event, optionally filtered by a specific listener.
     *
     * @param eventName - The name of the event (signal) to check.
     * @param listener - Optional specific listener to count.
     * @returns The number of listeners for the event.
     */
    public listenerCount(eventName: string, listener?: (...args: any[]) => void): number {
        return super.listenerCount(eventName, listener)
    }

    /**
     * Returns a copy of the array of listeners for a specific event.
     *
     * @param eventName - The name of the event (signal) to get listeners for.
     * @returns An array of listener functions.
     */
    public listeners(eventName: string): Function[] {
        return super.listeners(eventName)
    }

    /**
     * Removes a listener for a specific event, unsubscribing from the signal when it was the last one.
     *
     * @param eventName - The name of the event (signal) to remove the listener from.
     * @param listener - The callback function to remove.
     * @returns This instance for method chaining.
     */
    public off(eventName: string, listener: (...args: any[]) => void): this {
        super.off(eventName, listener)
        this.unsubscribeIfUnused(eventName)
        this.updateSignalEmitters()
        return this
    }

    /**
     * Adds a listener for the specified event (signal name), subscribing to the signal if needed.
     *
     * @param eventName - The name of the event (signal) to listen for.
     * @param listener - The callback function to execute when the event is emitted.
     * @returns This instance for method chaining.
     */
    public on(eventName: string, listener: (...args: any[]) => void): this {
        this.subscribe(eventName)
        super.on(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    /**
     * Adds a one-time listener for the specified event (signal name), subscribing to the signal if needed.
     * The subscription ends with the listener's removal after it fires, unless other listeners remain.
     *
     * @param eventName - The name of the event (signal) to listen for once.
     * @param listener - The callback function to execute when the event is emitted.
     * @returns This instance for method chaining.
     */
    public once(eventName: string, listener: (...args: any[]) => void): this {
        this.subscribe(eventName)
        super.once(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    /**
     * Prepends a listener for the specified event (signal name), subscribing to the signal if needed.
     *
     * @param eventName - The name of the event (signal) to listen for.
     * @param listener - The callback function to execute when the event is emitted.
     * @returns This instance for method chaining.
     */
    public prependListener(eventName: string, listener: (...args: any[]) => void): this {
        this.subscribe(eventName)
        super.prependListener(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    /**
     * Prepends a one-time listener for the specified event (signal name), subscribing to the signal if needed.
     *
     * @param eventName - The name of the event (signal) to listen for once.
     * @param listener - The callback function to execute when the event is emitted.
     * @returns This instance for method chaining.
     */
    public prependOnceListener(eventName: string, listener: (...args: any[]) => void): this {
        this.subscribe(eventName)
        super.prependOnceListener(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    /**
     * Returns a copy of the array of raw listeners for a specific event, including wrappers like once.
     *
     * @param eventName - The name of the event (signal) to get raw listeners for.
     * @returns An array of raw listener functions.
     */
    public rawListeners(eventName: string): Function[] {
        return super.rawListeners(eventName)
    }

    /**
     * Removes all listeners for a specific event or all events, unsubscribing from the affected signals.
     *
     * @param eventName - Optional name of the event (signal) to remove listeners from.
     * @returns This instance for method chaining.
     */
    public removeAllListeners(eventName?: string): this {
        const affected: string[] = eventName === undefined ? [...this.#rules.keys()] : [eventName]
        if (eventName === undefined) {
            super.removeAllListeners()
        } else {
            super.removeAllListeners(eventName)
        }
        affected.forEach((name: string): void => this.unsubscribeIfUnused(name))
        this.updateSignalEmitters()
        return this
    }

    /**
     * Removes a specific listener for an event, unsubscribing from the signal when it was the last one.
     *
     * @param eventName - The name of the event (signal) to remove the listener from.
     * @param listener - The callback function to remove.
     * @returns This instance for method chaining.
     */
    public removeListener(eventName: string, listener: (...args: any[]) => void): this {
        super.removeListener(eventName, listener)
        this.unsubscribeIfUnused(eventName)
        this.updateSignalEmitters()
        return this
    }

    /**
     * Sets the maximum number of listeners allowed for any event.
     *
     * @param n - The maximum number of listeners.
     * @returns This instance for method chaining.
     */
    public setMaxListeners(n: number): this {
        super.setMaxListeners(n)
        return this
    }
}
