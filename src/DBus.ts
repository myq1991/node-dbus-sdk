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
import {ServiceBasicInfo} from './types/ServiceBasicInfo'
import {RequestNameFlags} from './lib/RequestNameFlags'
import {RequestNameResultCode} from './lib/RequestNameResultCode'

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
        return this.addMatch(this.#signalRulesMap.get(rules)!)
    }

    protected offSignal(signalRuleString: string): void {
        return this.removeMatch(signalRuleString)
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

    public addMatch(rule: string): void {
        this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            method: 'AddMatch',
            signature: 's',
            args: [rule]
        }, true)
    }

    public removeMatch(rule: string): void {
        this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            method: 'RemoveMatch',
            signature: 's',
            args: [rule]
        }, true)
    }

    public async getNameOwner(name: string): Promise<string | undefined> {
        try {
            const [owner] = await this.invoke({
                service: 'org.freedesktop.DBus',
                objectPath: '/org/freedesktop/DBus',
                interface: 'org.freedesktop.DBus',
                method: 'GetNameOwner',
                signature: 's',
                args: [name]
            })
            return owner
        } catch (e) {
            return undefined
        }
    }

    public async listActivatableNames(): Promise<string[]> {
        const [activatableNames] = await this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            method: 'ListActivatableNames'
        })
        return activatableNames
    }

    public async listNames(): Promise<string[]> {
        const [names] = await this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            method: 'ListNames'
        })
        return names
    }

    public async nameHasOwner(name: string): Promise<boolean> {
        const [hasOwner] = await this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            signature: 's',
            method: 'NameHasOwner',
            args: [name]
        })
        return hasOwner
    }

    public async requestName(name: string, flags: RequestNameFlags = RequestNameFlags.DBUS_NAME_FLAG_DEFAULT): Promise<RequestNameResultCode> {
        const [res] = await this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            signature: 'su',
            method: 'RequestName',
            args: [name, flags]
        })
        return res
    }

    public async releaseName(name: string): Promise<number> {
        const [res] = await this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            signature: 's',
            method: 'ReleaseName',
            args: [name]
        })
        return res
    }

    public async reloadConfig(): Promise<void> {
        await this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            method: 'ReloadConfig'
        })
    }

    public async startServiceByName(name: string, flags: number = 0): Promise<number> {
        const [res] = await this.invoke({
            service: 'org.freedesktop.DBus',
            objectPath: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            signature: 'su',
            method: 'StartServiceByName'
        })
        return res
    }

    public async getConnectionUnixProcessID(name: string): Promise<number | undefined> {
        try {
            const [pid] = await this.invoke({
                service: 'org.freedesktop.DBus',
                objectPath: '/org/freedesktop/DBus',
                interface: 'org.freedesktop.DBus',
                method: 'GetConnectionUnixProcessID',
                signature: 's',
                args: [name]
            })
            return pid
        } catch (e) {
            return undefined
        }
    }

    /**
     * List all services
     */
    public async listServices(): Promise<ServiceBasicInfo[]> {
        let activeServiceNames: string[]
        let activatableServiceNames: string[]

        [
            activeServiceNames,
            activatableServiceNames
        ]
            = await Promise.all([
            this.listNames(),
            this.listActivatableNames()
        ])
        const serviceNames: string[] = [...new Set([...activeServiceNames, ...activatableServiceNames])]
        return await Promise.all(serviceNames.map((serviceName: string): Promise<ServiceBasicInfo> => {
            return new Promise(async (resolve): Promise<void> => {
                let uniqueId: string | undefined
                let pid: number | undefined
                [uniqueId, pid] = await Promise.all([
                    this.getNameOwner(serviceName),
                    this.getConnectionUnixProcessID(serviceName)
                ])
                return resolve({
                    name: serviceName,
                    uniqueId: uniqueId,
                    active: activeServiceNames.includes(serviceName),
                    activatable: activatableServiceNames.includes(serviceName),
                    pid: pid
                })
            })
        }))
    }

    /**
     * Get all services
     */
    public async getServices(): Promise<DBusService[]> {
        const serviceBasicInfos: ServiceBasicInfo[] = await this.listServices()
        return Promise.all(serviceBasicInfos.map((serviceBasicInfo: ServiceBasicInfo): Promise<DBusService> => this.getService(serviceBasicInfo.name)))
    }

    /**
     * Get service
     * @param service
     */
    public async getService(service: string): Promise<DBusService> {
        await this.startServiceByName(service)
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