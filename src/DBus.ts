import {MessageBus} from './MessageBus'
import {messageType} from './lib/Constants'

export class DBus {

    public readonly bus: MessageBus

    constructor(bus: MessageBus) {
        this.bus = bus
    }

    protected async getServices(): Promise<string[]> {
        let serviceNames: string[]
        [serviceNames] = await this.bus.invoke({
            type: messageType.methodCall,
            member: 'ListNames',
            path: '/org/freedesktop/DBus',
            destination: 'org.freedesktop.DBus',
            interface: 'org.freedesktop.DBus'
        })
        return serviceNames.filter((serviceName: string): boolean => !serviceName.startsWith(':'))
    }

    public async init(): Promise<this> {
        this.bus.signals.on(this.bus.mangle({
            path: '/slot1/port4/stc',
            interface: 'org.freedesktop.DBus.Properties',
            member: 'PropertiesChanged'
        }), (data: any, signature: string) => {
            console.log(data, signature)
        })
        await this.bus.invoke({
            type: messageType.methodCall,
            destination: 'org.freedesktop.DBus',
            path: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            member: 'AddMatch',
            signature: 's',
            body: ['type=signal'] // 匹配所有信号类型
        })
        console.log(await this.getServices())
        return this
    }

}