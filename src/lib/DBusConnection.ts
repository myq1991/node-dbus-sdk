import {CreateConnectOpts} from '../types/CreateConnectOpts'
import {Duplex} from 'node:stream'
import * as net from 'node:net'
import {ConnectOpts} from '../types/ConnectOpts'
import {
    AuthError,
    CreateStreamFailedError,
    NotEnoughParamsError, TimeoutError,
    UnknownBusAddressError,
    UnknownBusTypeError,
    UserPermissionError
} from './Errors'
import {BinaryLike, createHash, randomBytes} from 'node:crypto'
import path from 'node:path'
import {Stats} from 'node:fs'
import {readFile, stat} from 'node:fs/promises'
import {HandshakeOpts} from '../types/HandshakeOpts'
import EventEmitter from 'node:events'
import {Socket} from 'node:net'
import {NetConnectOpts} from 'net'
import {DBusMessage} from './DBusMessage'

export class DBusConnection extends EventEmitter {

    protected static defaultAuthMethods: string[] = ['EXTERNAL', 'DBUS_COOKIE_SHA1', 'ANONYMOUS']

    protected static defaultConnectTimeout: number = 20000

    /**
     * Sha1 hash
     * @param input
     * @protected
     */
    protected static sha1(input: BinaryLike): string {
        return createHash('sha1').update(input).digest('hex')
    }

    /**
     * Get user home
     * @protected
     */
    protected static getUserHome(): string {
        return process.env[process.platform.match(/\$win/) ? 'USERPROFILE' : 'HOME'] as string
    }

    /**
     * Get user cookie
     * @param context
     * @param id
     * @protected
     */
    protected static async getCookie(context: string, id: string): Promise<string> {
        // http://dbus.freedesktop.org/doc/dbus-specification.html#auth-mechanisms-sha
        const dirname: string = path.join(this.getUserHome(), '.dbus-keyrings')
        // > There is a default context, "org_freedesktop_general" that's used by servers that do not specify otherwise.
        if (context.length === 0) context = 'org_freedesktop_general'
        const filename: string = path.join(dirname, context)
        const stats: Stats = await stat(dirname)
        // check it's not writable by others and readable by user
        if (stats.mode & 0o22) throw new UserPermissionError('User keyrings directory is writeable by other users. Aborting authentication')
        if (process.hasOwnProperty('getuid') && stats.uid !== process.getuid!()) throw new UserPermissionError('Keyrings directory is not owned by the current user. Aborting authentication!')
        const keyrings: string = await readFile(filename, {encoding: 'ascii'})
        const lines: string[] = keyrings.split('\n')
        for (let l: number = 0; l < lines.length; ++l) {
            let data: string[] = lines[l].split(' ')
            if (data.length > 2 && id === data[0]) return data[2]
        }
        throw new UserPermissionError('Cookie not found')
    }

    /**
     * DBus connection handshake
     * @param stream
     * @param opts
     * @protected
     */
    protected static async handshake(stream: Duplex, opts?: HandshakeOpts): Promise<[string, string, string]> {
        const authMethods: string[] = opts?.authMethods || this.defaultAuthMethods
        stream.write('\0')
        const uid: number = opts?.uid ? opts.uid : process?.hasOwnProperty('getuid') ? process.getuid!() : 0
        const id: string = Buffer.from(uid.toString(), 'ascii').toString('hex')
        let authError: Error = new AuthError('No auth methods available')
        for (let authMethod of authMethods) {
            try {
                return [authMethod, uid.toString(), await this.tryAuth(stream, authMethod, id)]
            } catch (e: any) {
                authError = e
            }
        }
        throw authError
    }

    /**
     * Try auth
     * @protected
     */
    protected static async tryAuth(stream: Duplex, authMethod: string, id: string): Promise<string> {
        const readLine: () => Promise<Buffer> = (): Promise<Buffer> => {
            return new Promise((resolve, reject): void => {
                const bytes: number[] = []
                const readable: () => void = (): void => {
                    while (1) {
                        const buf: Buffer = stream.read(1)
                        if (!buf) return
                        const b: number = buf[0]
                        if (b === 0x0a) {
                            try {
                                resolve(Buffer.from(bytes))
                            } catch (error) {
                                reject(error)
                            } finally {
                                stream.removeListener('readable', readable)
                            }
                            return
                        }
                        bytes.push(b)
                    }
                }
                stream.on('readable', readable)
            })
        }
        const successAndBegin: () => Promise<string> = async (): Promise<string> => {
            const line: Buffer = await readLine()
            const ok: RegExpMatchArray | null = line.toString('ascii').match(/^([A-Za-z]+) (.*)/)
            if (ok && ok.length > 2 && ok[1] === 'OK') {
                stream.write('BEGIN\r\n')
                return ok[2] // ok[2] = guid
            }
            throw new AuthError(line.toString('ascii'))
        }
        switch (authMethod) {
            case 'EXTERNAL':
                stream.write(`AUTH ${authMethod} ${id}\r\n`)
                return await successAndBegin()
            case 'DBUS_COOKIE_SHA1':
                stream.write(`AUTH ${authMethod} ${id}\r\n`)
                const line: Buffer = await readLine()
                const data: string[] = Buffer
                    .from(line.toString().split(' ')[1].trim(), 'hex')
                    .toString()
                    .split(' ')
                const cookieContext: string = data[0]
                const cookieId: string = data[1]
                const serverChallenge = data[2]
                // any random 16 bytes should work, sha1(rnd) to make it simplier
                const clientChallenge: string = randomBytes(16).toString('hex')
                const cookie: string = await this.getCookie(cookieContext, cookieId)
                const response: string = this.sha1([serverChallenge, clientChallenge, cookie].join(':'))
                const reply: string = Buffer.from(`${clientChallenge}${response}`, 'ascii').toString('hex')
                stream.write(`DATA ${reply}\r\n`)
                return await successAndBegin()
            case 'ANONYMOUS':
                stream.write('AUTH ANONYMOUS \r\n')
                return await successAndBegin()
            default:
                throw new AuthError(`Unsupported auth method: ${authMethod}`)
        }
    }

    /**
     * Create duplex stream
     * @param opts
     * @protected
     */
    protected static async createDuplexStream(opts: NetConnectOpts): Promise<Duplex> {
        return new Promise((resolve, reject) => {
            const socket: Socket = net.createConnection(opts)
            const clean: (callback: () => void) => void = (callback: () => void): void => {
                socket
                    .off('timeout', timeoutHandler)
                    .off('error', errorHandler)
                    .off('connect', connectHandler)
                return callback()
            }
            const createResolve: () => void = (): void => clean((): void => resolve(socket))
            const createReject: (error: Error) => void = (error: Error): void => clean((): void => reject(error))
            const timeoutHandler: () => void = (): void => {
                socket.destroy()
                return createReject(new TimeoutError(`Connect timeout after ${opts.timeout} seconds`))
            }
            const errorHandler: (error: Error) => void = (error: Error): void => createReject(error)
            const connectHandler: () => void = (): void => createResolve()
            socket
                .once('timeout', timeoutHandler)
                .once('error', errorHandler)
                .once('connect', connectHandler)
        })
    }

    /**
     * Create TCP stream
     * @param timeout
     * @param port
     * @param host
     * @protected
     */
    protected static async createTCPStream(timeout: number, port: number | string, host?: string): Promise<Duplex> {
        port = parseInt(port.toString())
        host = host ? host : 'localhost'
        return await this.createDuplexStream({
            port: port,
            host: host,
            timeout: timeout
        })
    }

    /**
     * Create Unix stream
     * @param timeout
     * @param addr
     * @protected
     */
    protected static async createUnixStream(timeout: number, addr: string): Promise<Duplex> {
        return this.createDuplexStream({
            path: addr,
            timeout: timeout
        })
    }

    /**
     * Create duplex stream
     * @param opts
     * @protected
     */
    protected static async createStream(opts?: ConnectOpts): Promise<Duplex> {
        opts = opts ? opts : {}
        if ('stream' in opts) {
            return opts.stream
        }
        if ('socket' in opts) {
            return this.createUnixStream(opts.timeout ? opts.timeout : this.defaultConnectTimeout, opts.socket)
        }
        if ('port' in opts) {
            return this.createTCPStream(opts.timeout ? opts.timeout : this.defaultConnectTimeout, opts.port, opts.host)
        }
        const busAddress: string | undefined = opts.busAddress || process.env.DBUS_SESSION_BUS_ADDRESS
        if (!busAddress) throw new UnknownBusAddressError('Unknown bus address')
        const addresses: string[] = busAddress.split(';')
        const connectErrorHandler: (e: Error, isLastAddress: boolean) => void = (e: Error, isLastAddress: boolean): void => {
            if (isLastAddress) throw e
            console.warn(e.message)
        }
        for (let i: number = 0; i < addresses.length; i++) {
            const isLastAddress: boolean = i < (addresses.length - 1)
            const address: string = addresses[i]
            const familyParams: string[] = address.split(':')
            const family: string = familyParams[0].toLowerCase()
            const params: Record<string, string> = {}
            familyParams[1].split(',').map((param: string): string[] => param.split('=')).forEach(([key, value]): string => params[key] = value)
            switch (family) {
                case 'tcp':
                    return this.createTCPStream(opts.timeout ? opts.timeout : this.defaultConnectTimeout, params.port, params.host)
                case 'unix':
                    if (!params.socket && !params.path) connectErrorHandler(new NotEnoughParamsError('Not enough parameters for \'unix\' connection - you need to specify \'socket\' or \'path\' parameter'), isLastAddress)
                    return this.createUnixStream(opts.timeout ? opts.timeout : this.defaultConnectTimeout, params.socket || params.path)
                default:
                    connectErrorHandler(new UnknownBusTypeError(`Unknown address type: ${family}`), isLastAddress)
            }
        }
        throw new CreateStreamFailedError('Create stream failed')
    }

    /**
     * Create DBus connection
     * @param opts
     */
    public static async createConnection(opts?: CreateConnectOpts): Promise<DBusConnection> {
        opts = opts ? opts : {}
        const stream: Duplex = await this.createStream(opts)
        const [authMethod, uid, guid] = await this.handshake(stream, opts)
        return new DBusConnection(stream, authMethod, uid, guid)
    }

    /**
     * Duplex stream
     * @private
     */
    readonly #stream: Duplex

    /**
     * Auth method
     * @private
     */
    readonly #authMethod: string

    /**
     * UID
     * @private
     */
    readonly #uid: number

    /**
     * GUID
     * @private
     */
    readonly #guid: string

    /**
     * Auth method getter
     */
    public get authMethod(): string {
        return this.#authMethod
    }

    /**
     * UID getter
     */
    public get uid(): number {
        return this.#uid
    }

    /**
     * GUID getter
     */
    public get guid(): string {
        return this.#guid
    }

    /**
     * DBus connection constructor
     * @param stream
     * @param authMethod
     * @param uid
     * @param guid
     */
    constructor(stream: Duplex, authMethod: string, uid: string, guid: string) {
        super()
        this.#stream = stream
        this.#authMethod = authMethod
        this.#uid = parseInt(uid)
        this.#guid = guid
        let state: boolean = false // false: header, true: fields + body
        let header: Buffer
        let fieldsAndBody: Buffer
        let fieldsLength: number
        let fieldsLengthPadded: number
        let fieldsAndBodyLength: number = 0
        let bodyLength: number = 0
        this.#stream.on('close', (): boolean => this.emit('close'))
            .on('error', (error: Error): boolean => this.emit('error', error))
            .on('readable', (): void => {
                while (true) {
                    if (!state) {
                        header = stream.read(16)
                        if (!header) break
                        state = true
                        fieldsLength = header.readUInt32LE(12)
                        fieldsLengthPadded = ((fieldsLength + 7) >> 3) << 3
                        bodyLength = header.readUInt32LE(4)
                        fieldsAndBodyLength = fieldsLengthPadded + bodyLength
                    } else {
                        fieldsAndBody = stream.read(fieldsAndBodyLength)
                        if (!fieldsAndBody) break
                        state = false
                        this.emit('message', DBusMessage.decode(header, fieldsAndBody, fieldsLength, bodyLength))
                    }
                }
            })
        if ('setNoDelay' in this.#stream && typeof this.#stream.setNoDelay === 'function') this.#stream.setNoDelay()
    }

    /**
     * Write data
     * @param data
     */
    public write(data: Buffer): boolean {
        return this.#stream.write(data)
    }

    /**
     * End DBus connection
     * @param callback
     */
    public end(callback?: () => void): this {
        this.#stream.end(callback)
        return this
    }

    public on(eventName: 'message', listener: (message: DBusMessage) => void): this
    public on(eventName: 'close', listener: () => void): this
    public on(eventName: 'error', listener: (error: Error) => void): this
    public on(eventName: string, listener: (...args: any[]) => void): this
    public on(eventName: string, listener: (...args: any[]) => void): this {
        super.on(eventName, listener)
        return this
    }

    public once(eventName: 'message', listener: (message: DBusMessage) => void): this
    public once(eventName: 'close', listener: () => void): this
    public once(eventName: 'error', listener: (error: Error) => void): this
    public once(eventName: string, listener: (...args: any[]) => void): this
    public once(eventName: string, listener: (...args: any[]) => void): this {
        super.once(eventName, listener)
        return this
    }
}