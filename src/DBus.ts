import {DBusService} from './DBusService'
import {DBusObject} from './DBusObject'
import {DBusInterface} from './DBusInterface'
import {ConnectOpts} from './types/ConnectOpts'
import {DBusConnection} from './lib/DBusConnection'
import {DBusMessage} from './lib/DBusMessage'
import {InvokeOpts} from './types/InvokeOpts'
import {DBusMessageFlags} from './lib/DBusMessageFlags'
import {DBusMessageType} from './lib/DBusMessageType'
import {GetPropertyValueOpts} from './types/GetPropertyValueOpts'
import {SetPropertyValueOpts} from './types/SetPropertyValueOpts'
import {DBusSignedValue} from './lib/DBusSignedValue'
import {CreateSignalEmitterOpts} from './types/CreateSignalEmitterOpts'
import {DBusSignalEmitter} from './lib/DBusSignalEmitter'

export class DBus {

    #connection: DBusConnection

    #uniqueId: string

    #serial: number = 1

    #inflightCalls: Record<number, [(response: any[]) => void, (error: Error) => void]> = {}

    #signalEmitters: Set<WeakRef<DBusSignalEmitter>> = new Set()

    #signalRulesMap: Map<Record<string, string>, string> = new Map()

    /**
     * Connect to DBus
     * @param opts
     */
    public static async connect(opts: ConnectOpts): Promise<DBus> {
        const bus: DBus = new DBus(await DBusConnection.createConnection(opts))
        const [uniqueId] = await bus.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            method: 'Hello'
        })
        bus.#uniqueId = uniqueId
        return bus
    }

    /**
     * Write data to DBus socket
     * @param data
     */
    public write(data: Buffer) {
        //TODO 需要加入错误判断
        this.#connection.write(data)
    }


    public invoke(opts: InvokeOpts, noReply: true): void
    public async invoke(opts: InvokeOpts, noReply: false): Promise<any[]>
    public async invoke(opts: InvokeOpts): Promise<any[]>
    public invoke(opts: InvokeOpts, noReply: boolean = false): Promise<any[]> | void {
        if (noReply) {
            this.write(DBusMessage.encode({
                serial: this.#serial++,
                type: DBusMessageType.METHOD_CALL,
                flags: DBusMessageFlags.NO_REPLY_EXPECTED,
                destination: opts.service,
                path: opts.objectPath,
                interfaceName: opts.interface,
                member: opts.method,
                signature: opts.signature ? opts.signature : undefined
            }, ...opts.args ? opts.args : []))
        } else {
            return new Promise<any[]>((resolve, reject) => {
                const message: DBusMessage = new DBusMessage({
                    serial: this.#serial++,
                    type: DBusMessageType.METHOD_CALL,
                    flags: DBusMessageFlags.REPLY_EXPECTED,
                    destination: opts.service,
                    path: opts.objectPath,
                    interfaceName: opts.interface,
                    member: opts.method,
                    signature: opts.signature ? opts.signature : undefined
                }, ...opts.args ? opts.args : [])
                this.#inflightCalls[message.header.serial] = [resolve, reject]
                this.write(message.toBuffer())
            })
        }
    }

    public async getProperty(opts: GetPropertyValueOpts): Promise<any> {
        const [value] = await this.invoke({
            service: opts.service,
            objectPath: opts.objectPath,
            interface: 'org.freedesktop.DBus.Properties',
            method: 'Get',
            signature: 'ss',
            args: [opts.interface, opts.property]
        })
        return value
    }

    public async setProperty(opts: SetPropertyValueOpts): Promise<void> {
        const signedValue: DBusSignedValue = opts.signature ? new DBusSignedValue('v', new DBusSignedValue(opts.signature, opts.value)) : new DBusSignedValue('v', opts.value)
        await this.invoke({
            service: opts.service,
            objectPath: opts.objectPath,
            interface: 'org.freedesktop.DBus.Properties',
            method: 'Set',
            signature: 'ssv',
            args: [opts.interface, opts.property, signedValue]
        })
    }

    protected formatMatchSignalRule(uniqueId: string | '*', objectPath: string | '*', interfaceName: string | '*', signalName: string): string {
        const matchSignalRules: string[] = ['type=signal']
        if (uniqueId !== '*') matchSignalRules.push(`sender=${uniqueId}`)
        if (objectPath !== '*') matchSignalRules.push(`path=${objectPath}`)
        if (interfaceName !== '*') matchSignalRules.push(`interface=${interfaceName}`)
        matchSignalRules.push(`member=${signalName}`)
        return matchSignalRules.join(',')
    }

    protected onSignal(uniqueId: string | '*', objectPath: string | '*', interfaceName: string | '*', signalName: string | '*'): void {
        const rules: Record<string, string> = {
            uniqueId: uniqueId,
            objectPath: objectPath,
            interfaceName: interfaceName,
            signalName: signalName
        }
        this.#signalRulesMap.set(rules, this.formatMatchSignalRule(uniqueId, objectPath, interfaceName, signalName))
        return this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            method: 'AddMatch',
            signature: 's',
            args: [this.#signalRulesMap.get(rules)]
        }, true)
    }

    protected offSignal(signalRuleString: string) {
        this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            method: 'RemoveMatch',
            signature: 's',
            args: [signalRuleString]
        }, true)
    }

    public createSignalEmitter(opts: CreateSignalEmitterOpts): DBusSignalEmitter {
        const emitter: DBusSignalEmitter = new DBusSignalEmitter(
            opts,
            (
                service: string | '*',
                objectPath: string | '*',
                interfaceName: string | '*',
                signalName: string | '*'
            ): void => this.onSignal(
                service,
                objectPath,
                interfaceName,
                signalName
            )
        )
        const emitterRef: WeakRef<DBusSignalEmitter> = new WeakRef(emitter)
        this.#signalEmitters.add(emitterRef)
        return emitter
    }

    public _write() {
        // // const buf=new DBusMessage({
        // //     serial: 1,
        // //     destination: 'org.ptswitch.pad',
        // //     path: '/slot1/port1/stc',
        // //     interfaceName: 'pad.stc',
        // //     member: 'portGetSpeed'
        // // }).toBuffer()
        //
        // // const buf = new DBusMessage({
        // //     serial: 1,
        // //     type: 1,
        // //     destination: 'org.freedesktop.DBus',
        // //     path: '/org/freedesktop/DBus',
        // //     interfaceName: 'org.freedesktop.DBus',
        // //     member: 'Hello'
        // // }).toBuffer()

        // const buf = DBusMessage.encode({
        //     serial: 1,
        //     type: 1,
        //     destination: 'org.freedesktop.DBus',
        //     path: '/org/freedesktop/DBus',
        //     interfaceName: 'org.freedesktop.DBus',
        //     member: 'Hello'
        // })
        // console.log(JSON.stringify(Array.from(buf)), buf.length)
        // this.#connection.write(buf)
        //
        //
        // setInterval(() => {
        //     const buf2 = DBusMessage.encode({
        //         serial: 2,
        //         type: 1,
        //         flags: 0x01,
        //         destination: 'org.ptswitch.pad',
        //         path: '/slot1/port1/stc',
        //         interfaceName: 'pad.stc',
        //         member: 'portGetSpeed'
        //     })
        //     console.log(JSON.stringify(Array.from(buf2)), buf2.length)
        //     this.#connection.write(buf2)
        // }, 5000)

        // const l=Buffer.from([108,1,0,1,0,0,0,0,1,0,0,0,109,0,0,0,1,1,111,0,21,0,0,0,47,111,114,103,47,102,114,101,101,100,101,115,107,116,111,112,47,68,66,117,115,0,0,0,2,1,115,0,20,0,0,0,111,114,103,46,102,114,101,101,100,101,115,107,116,111,112,46,68,66,117,115,0,0,0,0,3,1,115,0,5,0,0,0,72,101,108,108,111,0,0,0,6,1,115,0,20,0,0,0,111,114,103,46,102,114,101,101,100,101,115,107,116,111,112,46,68,66,117,115,0,0,0,0])
        // console.log(l.toString('hex'))

        // this.#connection.write(Buffer.from([108,1,0,1,0,0,0,0,1,0,0,0,109,0,0,0,1,1,111,0,21,0,0,0,47,111,114,103,47,102,114,101,101,100,101,115,107,116,111,112,47,68,66,117,115,0,0,0,2,1,115,0,20,0,0,0,111,114,103,46,102,114,101,101,100,101,115,107,116,111,112,46,68,66,117,115,0,0,0,0,3,1,115,0,5,0,0,0,72,101,108,108,111,0,0,0,6,1,115,0,20,0,0,0,111,114,103,46,102,114,101,101,100,101,115,107,116,111,112,46,68,66,117,115,0,0,0,0]))
        // const buf=Buffer.from('4201000001010000010000000000000000000000000000000000000000000000010000006F00000001016F001500000072672E667265656465736B746F702E4442757300000002017300140000002F6F72672F667265656465736B746F702F4442757300000003017300130000006F72672E667265656465736B746F702E444275730000040173000500000048656C6C6F0000000000','hex')
        // console.log(JSON.stringify(Array.from(buf)),buf.length)
        // this.#connection.write(buf)
    }

    /**
     * DBus constructor
     * @param connection
     */
    constructor(connection: DBusConnection) {
        this.#connection = connection
        this.#connection.on('message', (message: DBusMessage): void => {
            switch (message.header.type) {
                case DBusMessageType.METHOD_RETURN:
                    if (!message.header.replySerial) return
                    if (!this.#inflightCalls[message.header.replySerial]) return
                    return this.#inflightCalls[message.header.replySerial][0](message.body)
                case DBusMessageType.ERROR:
                    if (!message.header.replySerial) return
                    if (!this.#inflightCalls[message.header.replySerial]) return
                    const error: Error = new Error(message.body[0] ? message.body[0] : '')
                    error.name = message.header.errorName ? message.header.errorName : error.name
                    return this.#inflightCalls[message.header.replySerial][1](error)
                case DBusMessageType.SIGNAL:
                    const sender: string = message.header.sender
                    const objectPath: string = message.header.path
                    const interfaceName: string = message.header.interfaceName
                    const signalName: string = message.header.member
                    const signalArgs: any[] = message.body
                    const emitResults: boolean[] = []
                    this.#signalEmitters.forEach((emitterRef: WeakRef<DBusSignalEmitter>): void => {
                        emitResults.push(((): boolean => {
                            const emitter: DBusSignalEmitter | undefined = emitterRef.deref()
                            if (!emitter) return this.#signalEmitters.delete(emitterRef)
                            if (emitter.uniqueId !== '*' && emitter.uniqueId !== sender) return false
                            if (emitter.objectPath !== '*' && emitter.objectPath !== objectPath) return false
                            if (emitter.interface !== '*' && emitter.interface !== interfaceName) return false
                            if (!emitter.eventNames().includes(signalName) && !emitter.eventNames().includes('*')) return false
                            const emitDirectly: boolean = emitter.emit(signalName, ...signalArgs)
                            const emitWildcard: boolean = emitter.emit('*', signalName, ...signalArgs)
                            return emitDirectly || emitWildcard
                        })())
                    })
                    if (emitResults.find((result: boolean): boolean => result)) return
                    const deprecatedSignalRuleStrings: string[] = []
                    this.#signalRulesMap.forEach((signalRuleString: string, rule: Record<string, string>): void => {
                        if (rule.uniqueId !== '*' && rule.uniqueId !== sender) return
                        if (rule.objectPath !== '*' && rule.objectPath !== objectPath) return
                        if (rule.interfaceName !== '*' && rule.interfaceName !== interfaceName) return
                        if (rule.signalName !== '*' && rule.signalName !== signalName) return
                        deprecatedSignalRuleStrings.push(signalRuleString)
                        this.#signalRulesMap.delete(rule)
                    })
                    return deprecatedSignalRuleStrings.forEach((deprecatedSignalRuleString: string): void => this.offSignal(deprecatedSignalRuleString))
                case DBusMessageType.METHOD_CALL:
                    //TODO
                    return
            }
        })
    }

    /**
     * List all services
     */
    public async listServices(): Promise<string[]> {
        //TODO
        return []
    }

    /**
     * Get all services
     */
    public async getServices(): Promise<DBusService[]> {
        const serviceNames: string[] = await this.listServices()
        return Promise.all(serviceNames.map((serviceName: string): Promise<DBusService> => this.getService(serviceName)))
    }

    /**
     * Get service
     * @param service
     */
    public async getService(service: string): Promise<DBusService> {
        //TODO 需要判断服务是否存在
        return new DBusService({dbus: this, service: service})
    }

    /**
     * Get object
     * @param service
     * @param objectPath
     */
    public async getObject(service: string, objectPath: string): Promise<DBusObject> {
        return (await this.getService(service)).getObject(objectPath)
    }

    /**
     * Get Interface
     * @param service
     * @param objectPath
     * @param iface
     */
    public async getInterface(service: string, objectPath: string, iface: string): Promise<DBusInterface> {
        return (await this.getObject(service, objectPath)).getInterface(iface)
    }
}