import {stringify} from 'json5'
import {DBus} from '../DBus'
import {runDBusBufferTestSet} from './DBusBuffer.spec'
import {DBusSignedValue} from '../lib/DBusSignedValue'
import {DBusBufferEncoder} from '../lib/DBusBufferEncoder'
import {DBusMessageEndianness} from '../lib/DBusMessageEndianness'
import {DBusBufferDecoder} from '../lib/DBusBufferDecoder'

// runDBusBufferTestSet()

setImmediate(async (): Promise<void> => {
    // const dbus=await DBus.connect({busAddress: 'tcp:host=192.168.1.236,port=44444'})
    const dbus = await DBus.connect({busAddress: 'tcp:host=192.168.0.96,port=44444'})
    console.log('success')
    // dbus.createSignalEmitter({
    //     // uniqueId:'org.ptswitch.pad',
    //     uniqueId: '*',//在DBus上真正发出信号的sender一般为服务的唯一id
    //     objectPath: '/slot1/port1/stc',
    //     interface: 'org.freedesktop.DBus.Properties'
    // })
    //     .on('PropertiesChanged', console.log)
    //     .on('*', console.log)
    // console.log(await dbus.listServices())
    const serv = await dbus.getService('org.ptswitch.pad')
    const obj = await serv.getObject('/slot1/port1/stc')

    // const serv = await dbus.getService('org.sigxcpu.Feedback')
    // const obj = await serv.getObject('/org/sigxcpu/Feedback')
    // console.log(await serv.listObjects())

    // const iface = await obj.getInterface('pad.stc')
    const iface = await obj.getInterface('org.freedesktop.DBus.Properties')

    // iface.signal.on('*',console.log)
    iface.signal.on('PropertiesChanged',console.log)


    // console.log(iface.listProperties())
    // console.log(await iface.property.serialNo.get())
    // console.log(await iface.method.portSetRate(100))
    // console.log(iface.noReplyMethod.portSetRate(100))
    // iface.method.xxxx
    // console.log((await obj.listInterfaces()))
    // console.log(await obj.listInterfaces())
})
