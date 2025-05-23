import {LocalService} from '../LocalService'
import {LocalInterface} from '../LocalInterface'
import {LocalObject} from '../LocalObject'
import EventEmitter from 'node:events'
import {DBusSignedValue} from '../lib/DBusSignedValue'

export async function runExposeService(): Promise<void> {
    let testProp: string = 'you'
    const ee = new EventEmitter()
    const serv = new LocalService('org.test.service2')
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
    // iface.defineMethod({
    //     name: 'fuckYou',
    //     inputArgs: [
    //         {
    //             name: 'name',
    //             type: 's'
    //         }
    //     ],
    //     outputArgs: [
    //         {
    //             name: 'result',
    //             type: 's'
    //         }
    //     ],
    //     method: (name: string): string => {
    //         return `fuck ${name}!!!`
    //     }
    // })
    iface.defineMethod({
        name: 'test',
        inputArgs: [{type: 'i'}],
        outputArgs: [{type: 'a{sv}'}],
        method: (name: number) => {
            // return ['ssss',true,123,3,[1,new DBusSignedValue('s','a'),3]]
            // return ['ssss',true,123,3,[1,2],[3,4]]
            // return ['ssss',true,123,3,[1,2],[3,4]]
            // return [['aaa','bbb'],['ccc',true]]
            // return {name:'123'}
            return {
                name: name
            }
            // return {
            //     name: name,
            //     act: 'fuck'
            // }
            // return [['name',name], ['act','fuck']]
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
    //
    // setInterval(() => {
    //     ee.emit('fuckSignal', `${Date.now()}`)
    // }, 3000)
}