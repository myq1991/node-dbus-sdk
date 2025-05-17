import EventEmitter from 'node:events'

/**
 * @deprecated
 */
export interface SignalListenerOpts {
    eventEmitter: WeakRef<EventEmitter> | EventEmitter
    service?: string
    objectPath?: string
    interface?: string
    signal?: string
}