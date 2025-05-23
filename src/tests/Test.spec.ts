import {DBus} from '../DBus'
import {DBusMessageEndianness} from '../lib/DBusMessageEndianness'
import {DBusBufferDecoder} from '../lib/DBusBufferDecoder'
import {DBusBufferEncoder} from '../lib/DBusBufferEncoder'
import {runExposeService} from './ExposeService.spec'
import {DBusSignedValue} from '../lib/DBusSignedValue'

// runDBusBufferTestSet()

// const enc = new DBusBufferEncoder()
// console.log(enc.encode('a{sv}', {}, true))

setImmediate(async (): Promise<void> => {

    await runExposeService()
    //
    const dbus = await DBus.connect({busAddress: 'tcp:host=192.168.1.236,port=44444'})
    // // const dbus = await DBus.connect({busAddress: 'tcp:host=192.168.0.96,port=44444'})
    console.log('success')
    // await new Promise<void>(resolve => setTimeout(() => resolve(), 1000))
    //
    // const serv = await dbus.getService('org.glib.test')
    const serv = await dbus.getService('org.test.service13')
    const obj = await serv.getObject('/')
    const iface = await obj.getInterface('test.iface')
    iface.signal.on('fuckSignal', console.log)
    console.log(await iface.method.test(123))


    // // const serv = await dbus.getService('org.sigxcpu.Feedback')
    // // const obj = await serv.getObject('/org/sigxcpu/Feedback')
    // // console.log(await obj.introspect())
    //
    // const serv = await dbus.getService('org.test.service')
    // // console.log(await serv.listObjects())
    // // const obj = await serv.getObject('/')
    // const obj = await serv.getObject('/test/obj')
    // const iface=await obj.getInterface('test.iface')
    // console.log(await iface.method.fuckYou('hello!'))

    // dbus.createSignalEmitter({
    //     // uniqueName:'org.ptswitch.pad',
    //     uniqueName: '*',//在DBus上真正发出信号的sender一般为服务的唯一id
    //     objectPath: '/slot1/port1/stc',
    //     interface: 'org.freedesktop.DBus.Properties'
    // })
    //     .on('PropertiesChanged', console.log)
    //     .on('*', console.log)
    // console.log(await dbus.listServices())
    // const serv = await dbus.getService('org.ptswitch.pad')
    // const obj = await serv.getObject('/slot1/port1/stc')
    // const obj = await serv.getObject('/slot1/port1')

    //
    // // const serv = await dbus.getService('org.sigxcpu.Feedback')
    // // const obj = await serv.getObject('/org/sigxcpu/Feedback')
    // // console.log(await serv.listObjects())
    //
    // const iface = await obj.getInterface('pad.stc')
    // const iface1 = await obj.getInterface('org.freedesktop.DBus.Properties')
    //
    // // iface.signal.on('*',console.log)
    // iface1.signal.on('PropertiesChanged', console.log)
    //
    //
    // // console.log(iface.listProperties())
    // // console.log(await iface.property.serialNo.get())
    // console.log(await iface.method.portSetRate(100))
    // // console.log(iface.noReplyMethod.portSetRate(100))
    // // iface.method.xxxx
    // // console.log((await obj.listInterfaces()))
    // // console.log(await obj.listInterfaces())
})
