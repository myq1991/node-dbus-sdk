import {EventEmitter} from 'node:events'
import {Duplex} from 'node:stream'
import {IDBusMessage} from './types/IDBusMessage'
import {MessageParser} from './lib/MessageParser'
import {IHandshakeOptions} from './types/IHandshakeOptions'
import {clientHandshake} from './lib/Handshake'
import {IDbusStreamConnectOptions} from './types/IDbusStreamConnectOptions'
import {IDbusTCPConnectOptions} from './types/IDbusTCPConnectOptions'
import {IDbusSocketConnectOptions} from './types/IDbusSocketConnectOptions'
import {IDbusBusAddressConnectOptions} from './types/IDbusBusAddressConnectOptions'
import net from 'net'

export enum DBusConnectionState {
    DISCONNECTED = 'DISCONNECTED',
    CONNECTED = 'CONNECTED'
}

export type ConnectOptions =
    IDbusStreamConnectOptions |
    IDbusTCPConnectOptions |
    IDbusSocketConnectOptions |
    IDbusBusAddressConnectOptions

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

    protected static createStream(options: ConnectOptions): Duplex {
        options = typeof options !== 'object' ? {} : options
        if ('stream' in options) {
            return options.stream
        }
        if ('socket' in options) {
            return net.createConnection(options.socket)
        }
        if ('port' in options) {
            return net.createConnection(options.port, options.host)
        }
        let busAddress: string | undefined = options.busAddress || process.env.DBUS_SESSION_BUS_ADDRESS
        if (!busAddress) throw new Error('unknown bus address')

        let addresses: string[] = busAddress.split(';')
        for (let i: number = 0; i < addresses.length; ++i) {
            let address: string = addresses[i]
            let familyParams: string[] = address.split(':')
            let family: string = familyParams[0]
            let params: any = {}
            familyParams[1].split(',').map(function (p) {
                let keyVal = p.split('=')
                params[keyVal[0]] = keyVal[1]
            })
            try {
                switch (family.toLowerCase()) {
                    case 'tcp':
                        let host = params.host || 'localhost'
                        let port = params.port
                        return net.createConnection(port, host)
                    case 'unix':
                        if (params.socket) return net.createConnection(params.socket)
                        if (params.path) return net.createConnection(params.path)
                        throw new Error(
                            'not enough parameters for \'unix\' connection - you need to specify \'socket\' or \'path\' parameter'
                        )
                    default:
                        throw new Error('unknown address type:' + family)
                }
            } catch (e: any) {
                if (i < addresses.length - 1) {
                    console.warn(e.message)
                } else {
                    throw e
                }
            }
        }
        throw new Error('create stream failed')
    }

    public static async createConnection(options?: ConnectOptions & IHandshakeOptions): Promise<DBusConnection> {
        if (!options) options = {}
        const connection = new DBusConnection(this.createStream(options))
        return await connection.init(options)
    }

    protected async init(options?: ConnectOptions & IHandshakeOptions): Promise<this> {
        if (this.#guid) return this
        this.#guid = await clientHandshake(this.#stream, options)
        this.emit('connect')
        this.#messageParser.parse(this.#stream, (msg: IDBusMessage): boolean => this.emit('message', msg), options)
        return this
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