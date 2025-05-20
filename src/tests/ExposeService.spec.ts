import {LocalService} from '../LocalService'
import {LocalInterface} from '../LocalInterface'
import {LocalObject} from '../LocalObject'
import EventEmitter from 'node:events'

export async function runExposeService(): Promise<void> {
    let testProp: string = 'you'
    const ee = new EventEmitter()
    const serv = new LocalService('org.test.service')
    // const obj = new LocalObject('/test/obj')
    const obj = new LocalObject('/')
    const iface = new LocalInterface('test.iface')
    iface.defineProperty({
        name: 'fuck',
        type: 's',
        getter: () => {
            return testProp
        },
        setter: (value: string) => {
            testProp = value
        }
    })
    iface.defineMethod({
        name: 'fuckYou',
        inputArgs: [
            {
                name: 'name',
                type: 's'
            }
        ],
        outputArgs: [
            {
                name: 'result',
                type: 's'
            }
        ],
        method: (name: string): string => {
            return `fuck ${name}!!!`
        }
    })
    iface.defineMethod({
        name: 'fuckYou111',
        inputArgs: [{type: 's'}],
        outputArgs: [{type: 's'}],
        method: (name: string): string => {
            return `fuck ${name}!!!`
        }
    })
    iface.defineSignal({
        name: 'fuckSignal',
        arg: [{
            name: 'timestamp',
            type: 's'
        }],
        eventEmitter: ee
    })

    obj.addInterface(iface)
    serv.addObject(obj)

    await serv.run({busAddress: 'tcp:host=192.168.0.96,port=44444'})
    //
    // setInterval(() => {
    //     ee.emit('fuckSignal', `${Date.now()}`)
    // }, 3000)
}