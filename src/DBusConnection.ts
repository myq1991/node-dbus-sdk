import {EventEmitter} from 'node:events'
import {Duplex} from 'node:stream'
import {IDBusMessage} from './types/IDBusMessage'
import {MessageParser} from './lib/MessageParser'
import {IDBusConnectionOptions} from './types/IDBusConnectionOptions'
import {IHandshakeOptions} from './types/IHandshakeOptions'
import {clientHandshake} from './lib/Handshake'

export enum DBusConnectionState {
    DISCONNECTED = 'DISCONNECTED',
    CONNECTED = 'CONNECTED'
}

export class DBusConnection extends EventEmitter {

    readonly #stream: Duplex

    #guid: string | void

    #messageHandler: (msg: IDBusMessage) => void

    #messages: IDBusMessage[] = []

    #state: DBusConnectionState = DBusConnectionState.DISCONNECTED

    #messageParser: MessageParser = new MessageParser()

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
            this.#messages.forEach((msg: IDBusMessage): boolean => this.write(this.#messageParser.marshall(msg)))
            this.#messages = []
            this.#messageHandler = (msg: IDBusMessage): boolean => this.write(this.#messageParser.marshall(msg))
        })
        if (typeof (<any>this.#stream).setNoDelay === 'function') {
            (<any>this.#stream).setNoDelay()
        }
    }

    public async init(options?: IDBusConnectionOptions & IHandshakeOptions): Promise<void> {
        if (this.#guid) return
        this.#guid = await clientHandshake(this.#stream, options)
        this.emit('connect')
        this.#messageParser.parse(this.#stream, (msg: IDBusMessage): boolean => this.emit('message', msg), options)
    }

    public message(msg: IDBusMessage): void {
        this.#messageHandler(msg)
    }

    public write(chunk: any): boolean {
        return this.#stream.write(chunk)
    }

    public end(): this {
        this.#stream.end()
        return this
    }
}