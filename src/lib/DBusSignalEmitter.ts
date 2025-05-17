import EventEmitter from 'node:events'
import {CreateSignalEmitterOpts} from '../types/CreateSignalEmitterOpts'

export class DBusSignalEmitter extends EventEmitter {

    constructor(opts: CreateSignalEmitterOpts) {
        super()
    }

    public addListener(eventName: string, listener: (...args: any[]) => void): this {
        //TODO
        return this
    }

    public emit(eventName: string, ...args: any[]): boolean {
        return false
    }

    public eventNames(): string[] {
        return []//TODO
    }

    public getMaxListeners(): number {
        //TODO
        return 0
    }

    public listenerCount(eventName: string, listener?: (...args: any[]) => void): number {
        //TODO
        return 0
    }

    public listeners(eventName: string): Array<(...args: any[]) => void> {
        //TODO
        return []
    }

    public off(eventName: string, listener: (...args: any[]) => void): this {
        //TODO
        return this
    }

    public on(eventName: string, listener: (...args: any[]) => void): this {
        //TODO
        return this
    }

    public once(eventName: string, listener: (...args: any[]) => void): this {
        //TODO
        return this
    }

    public prependListener(eventName: string, listener: (...args: any[]) => void): this {
        //TODO
        return this
    }

    public prependOnceListener<K>(eventName: string, listener: (...args: any[]) => void): this {
        //TODO
        return this
    }

    public rawListeners(eventName: string): Array<(...args: any[]) => void> {
        //TODO
        return []
    }

    public removeAllListeners(eventName?: string): this {
        //TODO
        return this
    }

    public removeListener(eventName: string, listener: (...args: any[]) => void): this {
        //TODO
        return this
    }

    public setMaxListeners(n: number): this {
        //TODO
        return this
    }

}