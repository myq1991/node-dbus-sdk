import {EventEmitter} from 'node:events'
import {DBusConnection} from './DBusConnection'
import {IDBusMessage} from './types/IDBusMessage'
import {messageType} from './lib/Constants'
import {stdDbusIfaces} from './lib/StandardInterfaces'
import {IObject} from './types/IObject'
import {IHandshakeOptions} from './types/IHandshakeOptions'

type Cookies = {
    [serial: number]: [(res?: any) => void, (err?: any) => void]
}

export class MessageBus {
    readonly #connection: DBusConnection
    #cookies: Cookies = {}
    #methodCallHandlers: Record<string, (...args: any) => any> = {}
    #signals: EventEmitter = new EventEmitter()
    #exportedObjects: Record<string, IObject> = {}
    #name: string

    public serial: number = 1

    public get connection(): DBusConnection {
        return this.#connection
    }

    public get signals(): EventEmitter {
        return this.#signals
    }

    public get exportedObjects(): Record<string, IObject> {
        return this.#exportedObjects
    }

    constructor(connection: DBusConnection, options: IHandshakeOptions = {}) {
        this.#connection = connection
        this.#connection.on('message', (msg: IDBusMessage): void => this.onMessage(msg))
        // register name
        if (options.direct !== true) {
            this.invokeDBus({member: 'Hello'}).then((name: string): string => [this.#name] = name)
        }
    }

    protected onMessage(msg: IDBusMessage): void {
        const self = this

        function invoke(impl, func, resultSignature) {
            Promise.resolve()
                .then(function () {
                    return func.apply(impl, (msg.body || []).concat(msg))
                })
                .then(
                    function (methodReturnResult) {
                        let methodReturnReply: IDBusMessage = {
                            type: messageType.methodReturn,
                            serial: self.serial++,
                            destination: msg.sender,
                            replySerial: msg.serial
                        }
                        if (methodReturnResult !== null) {
                            methodReturnReply.signature = resultSignature
                            methodReturnReply.body = [methodReturnResult]
                        }
                        self.connection.message(methodReturnReply)
                    },
                    function (e) {
                        self.sendError(
                            msg,
                            e.dbusName || 'org.freedesktop.DBus.Error.Failed',
                            e.message || ''
                        )
                    }
                )
        }

        let handler
        if (
            msg.type === messageType.methodReturn ||
            msg.type === messageType.error
        ) {
            if (typeof self.#cookies[msg.replySerial!] !== 'undefined') {
                const [resolve, reject] = self.#cookies[msg.replySerial!]
                delete self.#cookies[msg.replySerial!]
                let args = msg.body || []
                if (msg.type === messageType.methodReturn) {
                    resolve(args)
                } else {
                    reject(args)
                }
            }
        } else if (msg.type === messageType.signal) {
            self.signals.emit(self.mangle(msg), msg.body, msg.signature)
        } else {
            // methodCall

            if (stdDbusIfaces(msg, self)) return

            // exported interfaces handlers
            let obj, iface, impl
            if ((obj = self.#exportedObjects[msg.path!])) {
                if ((iface = obj[msg['interface']!])) {
                    // now we are ready to serve msg.member
                    impl = iface[1]
                    let func = impl[msg.member!]
                    if (!func) {
                        self.sendError(
                            msg,
                            'org.freedesktop.DBus.Error.UnknownMethod',
                            `Method "${msg.member}" on interface "${msg.interface}" doesn't exist`
                        )
                        return
                    }
                    // TODO safety check here
                    let resultSignature = iface[0].methods[msg.member!][1]
                    invoke(impl, func, resultSignature)
                    return
                } else {
                    // TODO: respond with standard dbus error
                    this.connection.emit('message_error', `Interface ${msg['interface']} is not supported`, msg)
                }
            }
            // setMethodCall handlers
            handler = self.#methodCallHandlers[self.mangle(msg)]
            if (handler) {
                invoke(null, handler[0], handler[1])
            } else {
                self.sendError(
                    msg,
                    'org.freedesktop.DBus.Error.UnknownService',
                    'Uh oh oh'
                )
            }
        }
    }

    protected async invokeDBus(msg: IDBusMessage): Promise<any> {
        if (!msg.path) msg.path = '/org/freedesktop/DBus'
        if (!msg.destination) msg.destination = 'org.freedesktop.DBus'
        if (!msg['interface']) msg['interface'] = 'org.freedesktop.DBus'
        return this.invoke(msg)
    }

    public mangle(msg: IDBusMessage): string
    public mangle(path: string, iface: string, member: string): string
    public mangle(path: IDBusMessage | string, iface?: string, member?: string): string {
        let obj: IDBusMessage = {}
        if (typeof path === 'object') {
            // handle one argument case mangle(msg)
            obj.path = path.path
            obj['interface'] = path['interface']
            obj.member = path.member
        } else {
            obj.path = path
            obj['interface'] = iface
            obj.member = member
        }
        return JSON.stringify(obj)
    }

    public async invoke(msg: IDBusMessage): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!msg.type) msg.type = messageType.methodCall
            msg.serial = this.serial++
            this.#cookies[msg.serial] = [resolve, reject]
            this.connection.message(msg)
        })
    }

    public sendSignal(path: string, iface: string, name: string, signature?: string, args?: any): void {
        let signalMsg: IDBusMessage = {
            type: messageType.signal,
            serial: this.serial++,
            interface: iface,
            path: path,
            member: name
        }
        if (signature) {
            signalMsg.signature = signature
            signalMsg.body = args
        }
        this.connection.message(signalMsg)
    }

    public sendError(msg: IDBusMessage, errorName: string, errorText: string): void {
        let reply: IDBusMessage = {
            type: messageType.error,
            serial: this.serial++,
            replySerial: msg.serial,
            destination: msg.sender,
            errorName: errorName,
            signature: 's',
            body: [errorText]
        }
        this.connection.message(reply)
    }

    public sendReply(msg: IDBusMessage, signature: string, body: any): void {
        let reply: IDBusMessage = {
            type: messageType.methodReturn,
            serial: this.serial++,
            replySerial: msg.serial,
            destination: msg.sender,
            signature: signature,
            body: body
        }
        this.connection.message(reply)
    }

    public setMethodCallHandler(objectPath: string, iface: string, member: string, handler: (...args: any) => any) {
        let key = this.mangle(objectPath, iface, member)
        this.#methodCallHandlers[key] = handler
    }

    public exportInterface(obj: IObject, path: string, iface: {
        name: string
        methods?: {
            [methodName: string]: [string, string, string[], string[]]
        }
        signals?: {
            [signalName: string]: [string, string]
        }
        properties?: {
            [propertyName: string]: string
        }
    }): void {
        const self: this = this
        let entry: IObject
        if (!this.#exportedObjects[path]) {
            entry = this.#exportedObjects[path] = {}
        } else {
            entry = this.#exportedObjects[path]
        }
        entry[iface.name] = [iface, obj]
        // monkey-patch obj.emit()
        if (typeof obj.emit === 'function') {
            let oldEmit = obj.emit
            obj.emit = function () {
                let args = Array.prototype.slice.apply(arguments)
                let signalName = args[0]
                if (!signalName) throw new Error('Trying to emit undefined signal')

                //send signal to bus
                let signal
                if (iface.signals && iface.signals[signalName]) {
                    signal = iface.signals[signalName]
                    let signalMsg: any = {
                        type: messageType.signal,
                        serial: self.serial++,
                        interface: iface.name,
                        path: path,
                        member: signalName
                    }
                    if (signal[0]) {
                        signalMsg.signature = signal[0]
                        signalMsg.body = args.slice(1)
                    }
                    self.connection.message(signalMsg)
                    self.serial++
                }
                // note that local emit is likely to be called before signal arrives
                // to remote subscriber
                oldEmit.apply(obj, args)
            }
        }
        // TODO: emit ObjectManager's InterfaceAdded
    }
}