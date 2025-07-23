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

/**
 * A class representing a low-level DBus connection.
 * Handles the creation of streams (TCP, Unix socket, etc.), authentication handshake,
 * and message reading/writing over the connection. Extends EventEmitter to emit events
 * for messages, connection closure, and errors.
 */
export class DBusConnection extends EventEmitter {

    /**
     * Default authentication methods supported by this connection class.
     * Used in the handshake process in order of preference.
     */
    protected static defaultAuthMethods: string[] = ['EXTERNAL', 'DBUS_COOKIE_SHA1', 'ANONYMOUS']

    /**
     * Default timeout for connection attempts in milliseconds.
     * Used if no specific timeout is provided in connection options.
     */
    protected static defaultConnectTimeout: number = 20000

    /**
     * Computes the SHA-1 hash of the input data.
     * Used during DBUS_COOKIE_SHA1 authentication to generate a response based on challenges and cookie.
     *
     * @param input - The data to hash, typically a string or buffer.
     * @returns The hexadecimal representation of the SHA-1 hash.
     */
    protected static sha1(input: BinaryLike): string {
        return createHash('sha1').update(input).digest('hex')
    }

    /**
     * Retrieves the user's home directory path based on the platform.
     * Used to locate DBus keyring files for authentication, adapting to Windows or Unix-like systems.
     *
     * @returns The path to the user's home directory as a string.
     */
    protected static getUserHome(): string {
        return process.env[process.platform.match(/\$win/) ? 'USERPROFILE' : 'HOME'] as string
    }

    /**
     * Retrieves a DBus authentication cookie from the user's keyring file.
     * Used during DBUS_COOKIE_SHA1 authentication to fetch a secret cookie for the response.
     *
     * @param context - The context name for the cookie (defaults to 'org_freedesktop_general' if empty).
     * @param id - The ID of the cookie to retrieve from the keyring file.
     * @returns A Promise resolving to the cookie value as a string.
     * @throws {UserPermissionError} If the keyring directory has incorrect permissions or the cookie is not found.
     */
    protected static async getCookie(context: string, id: string): Promise<string> {
        // Reference: http://dbus.freedesktop.org/doc/dbus-specification.html#auth-mechanisms-sha
        const dirname: string = path.join(this.getUserHome(), '.dbus-keyrings')
        // There is a default context, "org_freedesktop_general", that's used by servers that do not specify otherwise.
        if (context.length === 0) context = 'org_freedesktop_general'
        const filename: string = path.join(dirname, context)
        const stats: Stats = await stat(dirname)
        // Check if the directory is not writable by others and is readable by the user
        if (stats.mode & 0o22) throw new UserPermissionError('User keyrings directory is writeable by other users. Aborting authentication')
        if (process.hasOwnProperty('getuid') && stats.uid !== process.getuid!()) throw new UserPermissionError('Keyrings directory is not owned by the current user. Aborting authentication!')
        const keyrings: string = await readFile(filename, {encoding: 'ascii'})
        const lines: string[] = keyrings.split('\n')
        for (let l: number = 0; l < lines.length; ++l) {
            const data: string[] = lines[l].split(' ')
            if (data.length > 2 && id === data[0]) return data[2]
        }
        throw new UserPermissionError('Cookie not found')
    }

    /**
     * Performs the DBus connection handshake with the server over the provided stream.
     * Attempts authentication using the specified or default methods in sequence until one succeeds.
     *
     * @param stream - The duplex stream for communication with the DBus server.
     * @param opts - Optional handshake options, including custom authentication methods and UID.
     * @returns A Promise resolving to a tuple of [authMethod, uid, guid] upon successful handshake.
     * @throws {AuthError} If no authentication method succeeds or if all attempts fail.
     */
    protected static async handshake(stream: Duplex, opts?: HandshakeOpts): Promise<[string, string, string]> {
        const authMethods: string[] = opts?.authMethods || this.defaultAuthMethods
        stream.write('\0') // Initial null byte required by DBus protocol to start handshake
        const uid: number = opts?.uid ? opts.uid : process?.hasOwnProperty('getuid') ? process.getuid!() : 0
        const id: string = Buffer.from(uid.toString(), 'ascii').toString('hex')
        let authError: Error = new AuthError('No auth methods available')
        for (const authMethod of authMethods) {
            try {
                return [authMethod, uid.toString(), await this.tryAuth(stream, authMethod, id)]
            } catch (e: any) {
                authError = e
            }
        }
        throw authError
    }

    /**
     * Attempts authentication using a specific method.
     * Reads server responses and handles the authentication protocol for the chosen method.
     * Supports 'EXTERNAL', 'DBUS_COOKIE_SHA1', and 'ANONYMOUS' authentication mechanisms.
     *
     * @param stream - The duplex stream for communication with the DBus server.
     * @param authMethod - The authentication method to try (e.g., 'EXTERNAL', 'DBUS_COOKIE_SHA1', 'ANONYMOUS').
     * @param id - The hexadecimal representation of the user ID used for authentication.
     * @returns A Promise resolving to the server GUID upon successful authentication.
     * @throws {AuthError} If authentication fails or the method is unsupported.
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
                        if (b === 0x0a) { // Line feed character indicates end of response line
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
                stream.write('BEGIN\r\n') // Signal the start of normal DBus communication
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
                // Any random 16 bytes should work, used as client challenge in response
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
     * Creates a duplex stream for DBus communication based on network connection options.
     * Handles connection setup, timeouts, and errors for TCP or Unix socket connections.
     *
     * @param opts - Network connection options, including host, port, path, and timeout settings.
     * @returns A Promise resolving to a Duplex stream for communication with the DBus server.
     * @throws {TimeoutError} If the connection attempt times out after the specified duration.
     * @throws {Error} If the connection fails due to other reasons (e.g., network issues).
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
     * Creates a TCP stream for DBus communication.
     * Converts port input to a number and sets a default host if not provided.
     *
     * @param timeout - The connection timeout duration in milliseconds.
     * @param port - The port number (or string representation) to connect to.
     * @param host - Optional host address to connect to (defaults to 'localhost' if not specified).
     * @returns A Promise resolving to a Duplex stream for TCP communication with the DBus server.
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
     * Creates a Unix socket stream for DBus communication.
     * Uses the provided socket path for local communication.
     *
     * @param timeout - The connection timeout duration in milliseconds.
     * @param addr - The file path to the Unix socket for communication.
     * @returns A Promise resolving to a Duplex stream for Unix socket communication with the DBus server.
     */
    protected static async createUnixStream(timeout: number, addr: string): Promise<Duplex> {
        return this.createDuplexStream({
            path: addr,
            timeout: timeout
        })
    }

    /**
     * Creates a stream for DBus communication based on the provided options or environment variables.
     * Supports custom streams, direct socket paths, TCP connections, or bus addresses from environment.
     * Iterates through semicolon-separated bus addresses if multiple are provided, attempting each in sequence.
     *
     * @param opts - Optional connection options specifying a stream, socket path, TCP details, or bus address.
     * @returns A Promise resolving to a Duplex stream for communication with the DBus server.
     * @throws {UnknownBusAddressError} If no bus address is provided or found in environment variables.
     * @throws {UnknownBusTypeError} If the bus address type is unsupported (not 'tcp' or 'unix').
     * @throws {NotEnoughParamsError} If required parameters are missing for a specific bus type.
     * @throws {CreateStreamFailedError} If stream creation fails for all attempted addresses.
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
     * Static method to create a DBus connection.
     * Establishes a stream based on provided or default options, performs the handshake to authenticate,
     * and returns a fully initialized DBusConnection instance.
     *
     * @param opts - Optional connection and handshake options, including stream, bus address, or auth methods.
     * @returns A Promise resolving to a DBusConnection instance ready for communication.
     */
    public static async createConnection(opts?: CreateConnectOpts): Promise<DBusConnection> {
        opts = opts ? opts : {}
        const stream: Duplex = await this.createStream(opts)
        const [authMethod, uid, guid] = await this.handshake(stream, opts)
        return new DBusConnection(stream, authMethod, uid, guid, !!opts.advancedResponse, !!opts.convertBigIntToNumber)
    }

    /**
     * The duplex stream used for communication with the DBus server.
     * This private field holds the active stream for reading and writing data.
     */
    readonly #stream: Duplex

    /**
     * The authentication method used for this connection.
     * Stores the method (e.g., 'EXTERNAL') that succeeded during handshake.
     */
    readonly #authMethod: string

    /**
     * The user ID used during authentication.
     * Represents the UID of the connecting user, parsed as a number.
     */
    readonly #uid: number

    /**
     * The GUID provided by the server after successful authentication.
     * A unique identifier for the connection provided by the DBus daemon.
     */
    readonly #guid: string

    /**
     * Getter for the authentication method used in this connection.
     *
     * @returns The authentication method (e.g., 'EXTERNAL', 'DBUS_COOKIE_SHA1', 'ANONYMOUS') as a string.
     */
    public get authMethod(): string {
        return this.#authMethod
    }

    /**
     * Getter for the user ID used during authentication.
     *
     * @returns The user ID as a number.
     */
    public get uid(): number {
        return this.#uid
    }

    /**
     * Getter for the server-provided GUID.
     *
     * @returns The GUID as a string, identifying this connection on the server.
     */
    public get guid(): string {
        return this.#guid
    }

    /**
     * Checks if the connection is currently active.
     * Determines the connection status by checking if the stream is not closed.
     *
     * @returns True if the stream is not closed (connection is active), false otherwise.
     */
    public get connected(): boolean {
        return this.#stream ? !this.#stream.closed : false
    }

    /**
     * Constructor for DBusConnection.
     * Initializes the connection with the provided stream and authentication details,
     * sets up event listeners for reading messages, and handles connection closure and errors.
     * Implements a state machine to parse incoming DBus messages by reading headers and bodies.
     *
     * @param stream - The duplex stream for communication with the DBus server.
     * @param authMethod - The authentication method that succeeded during handshake.
     * @param uid - The user ID used during authentication, as a string (later parsed to number).
     * @param guid - The GUID provided by the server after successful authentication.
     * @param advancedResponse - Boolean flag to enable advanced response handling, where DBus return messages are organized using DBusTypeClass instances.
     * @param convertBigIntToNumber - Boolean flag to enable auto convert bigint to javascript number.
     */
    constructor(stream: Duplex, authMethod: string, uid: string, guid: string, advancedResponse: boolean = false, convertBigIntToNumber: boolean = false) {
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
                        header = stream.read(16) // DBus message header is 16 bytes
                        if (!header) break
                        state = true
                        fieldsLength = header.readUInt32LE(12) // Length of header fields
                        fieldsLengthPadded = ((fieldsLength + 7) >> 3) << 3 // Padded to 8-byte boundary
                        bodyLength = header.readUInt32LE(4) // Length of message body
                        fieldsAndBodyLength = fieldsLengthPadded + bodyLength
                    } else {
                        fieldsAndBody = stream.read(fieldsAndBodyLength)
                        if (!fieldsAndBody) {
                            console.log('OH!!!! BREAK!!!!!!!')
                            break
                        }
                        state = false
                        const decMsg = DBusMessage.decode(header, fieldsAndBody, fieldsLength, bodyLength, advancedResponse, convertBigIntToNumber)
                        if (decMsg.header.type === 2) console.log(decMsg)
                        this.emit('message', decMsg)
                        // this.emit('message', DBusMessage.decode(header, fieldsAndBody, fieldsLength, bodyLength, advancedResponse, convertBigIntToNumber))
                    }
                }
            })
        if ('setNoDelay' in this.#stream && typeof this.#stream.setNoDelay === 'function') this.#stream.setNoDelay()
    }

    /**
     * Writes data to the DBus connection stream.
     * Used to send encoded DBus messages to the server.
     *
     * @param data - The Buffer containing the data to write to the stream.
     * @returns True if the write operation was successful, false otherwise (e.g., if the stream is not writable).
     */
    public write(data: Buffer): boolean {
        return this.#stream.write(data)
    }

    /**
     * Closes the DBus connection stream.
     * Ends the connection, optionally executing a callback when the stream is fully closed.
     *
     * @param callback - Optional callback function to execute when the stream is closed.
     * @returns This instance for method chaining.
     */
    public end(callback?: () => void): this {
        this.#stream.end(callback)
        return this
    }

    /**
     * Adds an event listener for DBus connection events.
     * Supports multiple event types with specific callback signatures for handling messages,
     * connection closure, and errors. This method allows for type-safe event handling based on
     * the event name provided.
     *
     * @param eventName - The name of the event to listen for. Specific event names have predefined
     *                    callback signatures for type safety.
     * @param listener - The callback function to execute when the event occurs. The signature of the
     *                   callback depends on the event name.
     * @returns This instance for method chaining.
     *
     * @example
     * connection.on('message', (message) => console.log('Received message:', message));
     * connection.on('close', () => console.log('Connection closed'));
     * connection.on('error', (error) => console.error('Connection error:', error));
     */
    public on(eventName: 'message', listener: (message: DBusMessage) => void): this
    /**
     * Adds an event listener for the 'close' event, which is emitted when the DBus connection is closed.
     *
     * @param eventName - The string 'close', indicating the connection closure event.
     * @param listener - A callback function with no arguments, invoked when the connection closes.
     * @returns This instance for method chaining.
     */
    public on(eventName: 'close', listener: () => void): this
    /**
     * Adds an event listener for the 'error' event, which is emitted when an error occurs on the DBus connection.
     *
     * @param eventName - The string 'error', indicating the connection error event.
     * @param listener - A callback function that receives an Error object as its argument, invoked when an error occurs.
     * @returns This instance for method chaining.
     */
    public on(eventName: 'error', listener: (error: Error) => void): this
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
     * Adds a one-time event listener for DBus connection events.
     * The listener is executed only once when the specified event occurs and is then removed.
     * Supports multiple event types with specific callback signatures for handling messages,
     * connection closure, and errors. This method allows for type-safe event handling based on
     * the event name provided.
     *
     * @param eventName - The name of the event to listen for. Specific event names have predefined
     *                    callback signatures for type safety.
     * @param listener - The callback function to execute once when the event occurs. The signature of
     *                   the callback depends on the event name.
     * @returns This instance for method chaining.
     *
     * @example
     * connection.once('message', (message) => console.log('First message:', message));
     * connection.once('close', () => console.log('Connection closed'));
     * connection.once('error', (error) => console.error('First error:', error));
     */
    public once(eventName: 'message', listener: (message: DBusMessage) => void): this
    /**
     * Adds a one-time event listener for the 'close' event, which is emitted when the DBus connection is closed.
     *
     * @param eventName - The string 'close', indicating the connection closure event.
     * @param listener - A callback function with no arguments, invoked once when the connection closes.
     * @returns This instance for method chaining.
     */
    public once(eventName: 'close', listener: () => void): this
    /**
     * Adds a one-time event listener for the 'error' event, which is emitted when an error occurs on the DBus connection.
     *
     * @param eventName - The string 'error', indicating the connection error event.
     * @param listener - A callback function that receives an Error object as its argument, invoked once when an error occurs.
     * @returns This instance for method chaining.
     */
    public once(eventName: 'error', listener: (error: Error) => void): this
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
}
