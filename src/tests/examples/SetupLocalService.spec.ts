import {LocalService} from '../../LocalService'
import {LocalObject} from '../../LocalObject'
import {LocalInterface} from '../../LocalInterface'
import EventEmitter from 'node:events'

export async function SetupLocalServiceSpec(serviceName: string, busAddress: string): Promise<void> {
    let yourName: string = 'Hello Kitty'
    const eventEmitter: EventEmitter = new EventEmitter()
    setInterval((): void => {
        eventEmitter.emit('TestSignal', new Date().toString())
    }, 1000)
    const service: LocalService = new LocalService(serviceName)
    const object1: LocalObject = new LocalObject('/test/object1')
    const object2: LocalObject = new LocalObject('/test/object2')
    const iface1: LocalInterface = new LocalInterface('test.iface1')
    const iface2: LocalInterface = new LocalInterface('test.iface2')
    iface1
        .defineMethod({
            name: 'SayHello',
            inputArgs: [{
                name: 'name',
                type: 's'
            }],
            outputArgs: [{
                type: 's'
            }],
            method: async (input: string): Promise<string> => {
                return `Hello! ${input}`
            }
        })
        .defineMethod({
            name: 'GetTime',
            outputArgs: [{
                name: 'ts',
                type: 's'
            }],
            method: async (): Promise<string> => `Now: ${new Date().toString()}`
        })
    iface1
        .defineProperty({
            name: 'Timestamp',
            type: 'x',
            getter: () => Date.now()
        })
        .defineProperty({
            name: 'YourName',
            type: 's',
            getter: (): string => yourName,
            setter: (name: string): void => {
                yourName = name
            }
        })
    iface2
        .defineSignal({
            name: 'TestSignal',
            args: [{
                name: 'value',
                type: 's'
            }],
            eventEmitter: eventEmitter
        })
    iface2.defineMethod({
        name: 'InterfaceSleep',
        inputArgs: [{
            name: 'seconds',
            type: 'i'
        }],
        outputArgs: [{
            name: 'result',
            type: 's'
        }],
        method: (seconds: number): string => {
            setImmediate((): void => {
                object2.removeInterface(iface2)
                setTimeout((): void => {
                    object2.addInterface(iface2)
                }, seconds * 1000)
            })
            return 'OK'
        }
    })
    await service.run({busAddress: busAddress})
    await new Promise<void>(resolve => setTimeout(resolve, 1000))
    service.addObject(object1)
    await new Promise<void>(resolve => setTimeout(resolve, 1000))
    service.addObject(object2)
    await new Promise<void>(resolve => setTimeout(resolve, 1000))
    object1.addInterface(iface1)
    await new Promise<void>(resolve => setTimeout(resolve, 1000))
    object2.addInterface(iface2)
    await new Promise<void>(resolve => setTimeout(resolve, 1000))
    console.info(`Local service ${serviceName} startup completely`)
}