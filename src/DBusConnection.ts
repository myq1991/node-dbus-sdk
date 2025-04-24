import {EventEmitter} from 'node:events'
import {Duplex} from 'node:stream'
import {IDBusMessage} from './types/IDBusMessage'

export enum DBusConnectionState {
    DISCONNECTED = 'DISCONNECTED',
    CONNECTED = 'CONNECTED'
}

export class DBusConnection extends EventEmitter {

    #stream: Duplex

    #messageHandler: (msg: IDBusMessage) => void

    #messages: IDBusMessage[] = []

    #state: DBusConnectionState = DBusConnectionState.DISCONNECTED

    constructor(stream: Duplex) {
        super()
        this.#stream = stream
        this.#stream
            .on('error', (err: Error): boolean => this.emit('error', err))
            .on('end', (): void => {
                this.emit('end')
                this.#messageHandler = (): never => {
                    throw new Error('DBus socket closed')
                }
            })
        this.#messageHandler = (msg: IDBusMessage): number => this.#messages.push(msg)
        this.once('connect', (): void => {
            this.#state = DBusConnectionState.CONNECTED
            // this.#messages.forEach((msg: IDBusMessage): boolean => this.write(msg))
        })
    }

    public write(chunk: any): boolean {
        return this.#stream.write(chunk)
    }
}