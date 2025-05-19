import EventEmitter from 'node:events'
import {CreateSignalEmitterOpts} from '../types/CreateSignalEmitterOpts'

export class DBusSignalEmitter extends EventEmitter {

    readonly #signalEmitters: Set<DBusSignalEmitter>

    #uniqueName: string | '*'

    #objectPath: string | '*'

    #interface: string | '*'

    protected readonly onSignalHandler: (service: string | '*', objectPath: string | '*', interfaceName: string | '*', signalName: string | '*') => void

    public readonly service: string

    public get uniqueName(): string | '*' {
        return this.#uniqueName
    }

    public get objectPath(): string | '*' {
        return this.#objectPath
    }

    public get interface(): string | '*' {
        return this.#interface
    }

    constructor(opts: CreateSignalEmitterOpts, signalEmitters: Set<DBusSignalEmitter>, onSignalHandler: (service: string | '*', objectPath: string | '*', interfaceName: string | '*', signalName: string | '*') => void) {
        super()
        this.#signalEmitters = signalEmitters
        this.onSignalHandler = onSignalHandler
        this.#uniqueName = opts.uniqueName
        this.#objectPath = opts.objectPath
        this.#interface = opts.interface
    }

    protected updateUniqueName(newUniqueName: string): void {
        if (this.uniqueName === '*') return
        this.#uniqueName = newUniqueName
        this.eventNames().forEach((eventName: string): void => this.onSignalHandler(this.uniqueName, this.objectPath, this.interface, eventName))
    }

    protected updateSignalEmitters(): void {
        if (!this.eventNames().length) {
            if (this.#signalEmitters.has(this)) this.#signalEmitters.delete(this)
        } else {
            if (!this.#signalEmitters.has(this)) this.#signalEmitters.add(this)
        }
    }

    public addListener(eventName: string, listener: (...args: any[]) => void): this {
        this.onSignalHandler(this.uniqueName, this.objectPath, this.interface, eventName)
        super.addListener(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    public emit(eventName: string, ...args: any[]): boolean {
        const emitResult: boolean = super.emit(eventName, ...args)
        this.updateSignalEmitters()
        return emitResult
    }

    public eventNames(): string[] {
        return super.eventNames() as string[]
    }

    public getMaxListeners(): number {
        return super.getMaxListeners()
    }

    public listenerCount(eventName: string, listener?: (...args: any[]) => void): number {
        return super.listenerCount(eventName, listener)
    }

    public listeners(eventName: string): Function[] {
        return super.listeners(eventName)
    }

    public off(eventName: string, listener: (...args: any[]) => void): this {
        super.off(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    public on(eventName: string, listener: (...args: any[]) => void): this {
        this.onSignalHandler(this.uniqueName, this.objectPath, this.interface, eventName)
        super.on(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    public once(eventName: string, listener: (...args: any[]) => void): this {
        this.onSignalHandler(this.uniqueName, this.objectPath, this.interface, eventName)
        super.once(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    public prependListener(eventName: string, listener: (...args: any[]) => void): this {
        this.onSignalHandler(this.uniqueName, this.objectPath, this.interface, eventName)
        super.prependListener(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    public prependOnceListener(eventName: string, listener: (...args: any[]) => void): this {
        this.onSignalHandler(this.uniqueName, this.objectPath, this.interface, eventName)
        super.prependOnceListener(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    public rawListeners(eventName: string): Function[] {
        return super.rawListeners(eventName)
    }

    public removeAllListeners(eventName?: string): this {
        super.removeAllListeners(eventName)
        this.updateSignalEmitters()
        return this
    }

    public removeListener(eventName: string, listener: (...args: any[]) => void): this {
        super.removeListener(eventName, listener)
        this.updateSignalEmitters()
        return this
    }

    public setMaxListeners(n: number): this {
        super.setMaxListeners(n)
        return this
    }

}