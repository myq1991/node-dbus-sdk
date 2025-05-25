import {LocalService} from '../LocalService'
import {LocalInterface} from '../LocalInterface'
import {LocalObject} from '../LocalObject'
import EventEmitter from 'node:events'
import {DBusSignedValue} from '../lib/DBusSignedValue'

export async function runExposeService(): Promise<void> {
    let test1Prop: string[] = ['you']
    let test2Prop: string = 'abc'
    let test3Prop: number = 123
    const ee = new EventEmitter()
    const serv = new LocalService('org.test.service13')
    // const obj = new LocalObject('/test/obj')
    const obj = new LocalObject('/test/obj')
    const iface = new LocalInterface('test.iface')
    iface
        .defineProperty({
            name: 'test1',
            type: 'av',
            emitPropertiesChanged: {emitValue: true},
            getter: () => {
                return test1Prop
            },
            setter: (value: string[]) => {
                test1Prop = value
            }
        })
        .defineProperty({
            name: 'test2',
            type: 'v',
            emitPropertiesChanged: {emitValue: true},
            getter: () => {
                return test2Prop
            },
            setter: (value: string) => {
                test2Prop = value
            }
        })
        .defineProperty({
            name: 'test3',
            type: 'v',
            emitPropertiesChanged: {emitValue: false},
            getter: () => {
                return test3Prop
            },
            setter: (value: number) => {
                test3Prop = value
            }
        })
    iface.defineMethod({
        name: 'test',
        inputArgs: [{type: 'u'}],
        // outputArgs: [{type: 'a{sv}'}],
        // outputArgs: [{type: 'av'}],
        outputArgs: [{type: 'v'}],
        method: (name: number = 1234) => {
            return {
                name: name,
                haha: true,
                sleep: 'oh!'
            }
        }
    })
    iface.defineSignal({
        name: 'fuckSignal',
        args: [{
            name: 'timestamp',
            type: 's'
        }],
        eventEmitter: ee
    })

    obj.addInterface(iface)
    serv.addObject(obj)

    // await serv.run({busAddress: 'tcp:host=192.168.0.96,port=44444'})
    await serv.run({busAddress: 'tcp:host=192.168.1.236,port=44444'})

    setInterval(() => {
        iface.setProperty('test1', [`${Date.now()}`])
        iface.setProperty('test2', `test2-${Date.now()}`)
        iface.setProperty('test3', BigInt(Date.now()))
        setTimeout(() => {
            iface.setProperty('test2', `test2-${Date.now()}`)
            iface.setProperty('test3', BigInt(Date.now()))
        }, 1)
    }, 3000)

    // setTimeout(() => {
    //     serv.addObject(obj)
    //     setTimeout(() => {
    //         obj.addInterface(iface)
    //         setTimeout(() => {
    //             obj.removeInterface(iface)
    //             setTimeout(() => {
    //                 serv.removeObject(obj)
    //             }, 3000)
    //         }, 3000)
    //     }, 3000)
    // }, 3000)

    //
    // setInterval(() => {
    //     ee.emit('fuckSignal', `${Date.now()}`)
    // }, 3000)
}