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
    dbus.createSignalEmitter({
        // uniqueId:'org.ptswitch.pad',
        uniqueId: '*',//在DBus上真正发出信号的sender一般为服务的唯一id
        objectPath: '/slot1/port1/stc',
        interface: 'org.freedesktop.DBus.Properties'
    })
        .on('PropertiesChanged', console.log)
        .on('*', console.log)
    // dbus.write()
//     // const dbuf = new DBusBuffer()
//     // const data = `{"name":"Json.CN","url":"http://www.json.cn","page":88,"isNonProfit":true,"address":{"street":"科技园路.","city":"江苏苏州","country":"中国"},"links":[{"name":"Google","url":"http://www.google.com"},{"name":"Baidu","url":"http://www.baidu.com"},{"name":"SoSo","url":"http://www.SoSo.com"}]}`
//     //
//     // const buffer=new DBusBuffer().write('ssib(sss)a(ss)', JSON.parse(`{"name":"Json.CN","url":"http://www.json.cn","page":88,"isNonProfit":true,"address":{"street":"科技园路.","city":"江苏苏州","country":"中国"},"links":[{"name":"Google","url":"http://www.google.com"},{"name":"Baidu","url":"http://www.baidu.com"},{"name":"SoSo","url":"http://www.SoSo.com"}]}`)).toBuffer()
//     const buffer = new DBusBuffer().write('a{sv}', {a: true, b: 1, c: '1234'}).toBuffer()
//     console.log(buffer)
//     console.log(new DBusBuffer(buffer).read('a{sv}'))
})
