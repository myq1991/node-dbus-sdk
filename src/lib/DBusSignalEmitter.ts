import EventEmitter from 'node:events'
import {CreateSignalEmitterOpts} from '../types/CreateSignalEmitterOpts'

/**
 * A class that extends Node.js EventEmitter to handle DBus signal emissions.
 * Manages signal listeners and emitters for a specific DBus service, object path, and interface.
 * Supports wildcard '*' for unique name, object path, and interface to handle multiple sources.
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
     * A handler function to be called when a signal is registered or emitted.
     * Used to notify external systems about signal subscriptions or emissions.
     */
    protected readonly onSignalHandler: (service: string | '*', objectPath: string | '*', interfaceName: string | '*', signalName: string | '*') => void

    /**
     * The service name associated with this emitter.
     * This is a public readonly property, though it is not initialized in the provided code.
     * Likely set elsewhere or intended for future use.
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
     * Initializes the emitter with options and a handler for signal events.
     *
     * @param opts - Options for creating the signal emitter, including uniqueName, objectPath, and interface.
     * @param signalEmitters - A set of all DBusSignalEmitter instances to manage active emitters.
     * @param onSignalHandler - A callback function invoked when signals are registered or updated.
     */
    constructor(opts: CreateSignalEmitterOpts, signalEmitters: Set<DBusSignalEmitter>, onSignalHandler: (service: string | '*', objectPath: string | '*', interfaceName: string | '*', signalName: string | '*') => void) {
        super()
        this.#signalEmitters = signalEmitters
        this.onSignalHandler = onSignalHandler
        this.#uniqueName = opts.uniqueName
        this.#objectPath = opts.objectPath
        this.#interface = opts.interface
    }

    /**
     * Updates the unique name of the emitter if it is not set to wildcard '*'.
     * Notifies the signal handler for each registered event with the updated unique name.
     *
     * @param newUniqueName - The new unique name to set for this emitter.
     */
    protected updateUniqueName(newUniqueName: string): void {
        if (this.uniqueName === '*') return
        this.#uniqueName = newUniqueName
        this.eventNames().forEach((eventName: string): void => this.onSignalHandler(this.uniqueName, this.objectPath, this.interface, eventName))
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
     * Adds a listener for the specified event (signal name) and notifies the signal handler.
     * Overrides EventEmitter's addListener to include DBus-specific logic.
     *
     * @param eventName - The name of the event (signal) to listen for.
     * @param listener - The callback function to execute when the event is emitted.
     * @returns This instance for method chaining.
     */
    public addListener(eventName: string, listener: (...args: any[]) => void): this {
        this.onSignalHandler(this.uniqueName, this.objectPath, this.interface, eventName)
        super.addListener(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    /**
     * Emits an event (signal) with the provided arguments and updates the signal emitters set.
     * Overrides EventEmitter's emit to include DBus-specific logic.
     *
     * @param eventName - The name of the event (signal) to emit.
     * @param args - Arguments to pass to the event listeners.
     * @returns True if the event had listeners, false otherwise.
     */
    public emit(eventName: string, ...args: any[]): boolean {
        const emitResult: boolean = super.emit(eventName, ...args)
        this.updateSignalEmitters()
        return emitResult
    }

    /**
     * Returns an array of event names (signal names) for which this emitter has listeners.
     *
     * @returns An array of event names as strings.
     */
    public eventNames(): string[] {
        return super.eventNames() as string[]
    }

    /**
     * Returns the maximum number of listeners allowed for any event.
     *
     * @returns The maximum number of listeners.
     */
    public getMaxListeners(): number {
        return super.getMaxListeners()
    }

    /**
     * Returns the number of listeners for a specific event.
     *
     * @param eventName - The name of the event to check.
     * @param listener - Optional specific listener function to count.
     * @returns The number of listeners for the event.
     */
    public listenerCount(eventName: string, listener?: (...args: any[]) => void): number {
        return super.listenerCount(eventName, listener)
    }

    /**
     * Returns an array of listener functions for a specific event.
     *
     * @param eventName - The name of the event to retrieve listeners for.
     * @returns An array of listener functions.
     */
    public listeners(eventName: string): Function[] {
        return super.listeners(eventName)
    }

    /**
     * Removes a specific listener for an event and updates the signal emitters set.
     *
     * @param eventName - The name of the event.
     * @param listener - The listener function to remove.
     * @returns This instance for method chaining.
     */
    public off(eventName: string, listener: (...args: any[]) => void): this {
        super.off(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    /**
     * Adds a listener for an event and notifies the signal handler.
     *
     * @param eventName - The name of the event (signal) to listen for.
     * @param listener - The callback function to execute when the event is emitted.
     * @returns This instance for method chaining.
     */
    public on(eventName: string, listener: (...args: any[]) => void): this {
        this.onSignalHandler(this.uniqueName, this.objectPath, this.interface, eventName)
        super.on(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    /**
     * Adds a one-time listener for an event and notifies the signal handler.
     *
     * @param eventName - The name of the event (signal) to listen for.
     * @param listener - The callback function to execute once when the event is emitted.
     * @returns This instance for method chaining.
     */
    public once(eventName: string, listener: (...args: any[]) => void): this {
        this.onSignalHandler(this.uniqueName, this.objectPath, this.interface, eventName)
        super.once(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    /**
     * Adds a listener to the beginning of the listeners array for an event and notifies the signal handler.
     *
     * @param eventName - The name of the event (signal) to listen for.
     * @param listener - The callback function to execute when the event is emitted.
     * @returns This instance for method chaining.
     */
    public prependListener(eventName: string, listener: (...args: any[]) => void): this {
        this.onSignalHandler(this.uniqueName, this.objectPath, this.interface, eventName)
        super.prependListener(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    /**
     * Adds a one-time listener to the beginning of the listeners array for an event and notifies the signal handler.
     *
     * @param eventName - The name of the event (signal) to listen for.
     * @param listener - The callback function to execute once when the event is emitted.
     * @returns This instance for method chaining.
     */
    public prependOnceListener(eventName: string, listener: (...args: any[]) => void): this {
        this.onSignalHandler(this.uniqueName, this.objectPath, this.interface, eventName)
        super.prependOnceListener(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    /**
     * Returns an array of raw listener functions for a specific event (including wrappers like 'once').
     *
     * @param eventName - The name of the event to retrieve listeners for.
     * @returns An array of raw listener functions.
     */
    public rawListeners(eventName: string): Function[] {
        return super.rawListeners(eventName)
    }

    /**
     * Removes all listeners for an event (or all events if no event name is provided) and updates the signal emitters set.
     *
     * @param eventName - Optional name of the event to remove listeners for.
     * @returns This instance for method chaining.
     */
    public removeAllListeners(eventName?: string): this {
        super.removeAllListeners(eventName)
        this.updateSignalEmitters()
        return this
    }

    /**
     * Removes a specific listener for an event and updates the signal emitters set.
     *
     * @param eventName - The name of the event.
     * @param listener - The listener function to remove.
     * @returns This instance for method chaining.
     */
    public removeListener(eventName: string, listener: (...args: any[]) => void): this {
        super.removeListener(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    /**
     * Sets the maximum number of listeners allowed for any event.
     *
     * @param n - The maximum number of listeners to set.
     * @returns This instance for method chaining.
     */
    public setMaxListeners(n: number): this {
        super.setMaxListeners(n)
        return this
    }
}
