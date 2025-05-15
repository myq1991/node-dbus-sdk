import {DBus} from '../DBus'
import {DBusBuffer} from '../lib/DBusBuffer'
import {runDBusBufferReadArrayTestSet, runDBusBufferTestSet} from './DBusBuffer.spec'
import {DBusSignedValue} from '../lib/DBusSignedValue'

// runDBusBufferTestSet()
// runDBusBufferReadArrayTestSet()

// setImmediate(async (): Promise<void> => {
//     const dbus=await DBus.connect({busAddress: 'tcp:host=192.168.1.236,port=44444'})
//     console.log('success')
//     dbus.write()
// //     // const dbuf = new DBusBuffer()
// //     // const data = `{"name":"Json.CN","url":"http://www.json.cn","page":88,"isNonProfit":true,"address":{"street":"科技园路.","city":"江苏苏州","country":"中国"},"links":[{"name":"Google","url":"http://www.google.com"},{"name":"Baidu","url":"http://www.baidu.com"},{"name":"SoSo","url":"http://www.SoSo.com"}]}`
// //     //
// //     // const buffer=new DBusBuffer().write('ssib(sss)a(ss)', JSON.parse(`{"name":"Json.CN","url":"http://www.json.cn","page":88,"isNonProfit":true,"address":{"street":"科技园路.","city":"江苏苏州","country":"中国"},"links":[{"name":"Google","url":"http://www.google.com"},{"name":"Baidu","url":"http://www.baidu.com"},{"name":"SoSo","url":"http://www.SoSo.com"}]}`)).toBuffer()
// //     const buffer = new DBusBuffer().write('a{sv}', {a: true, b: 1, c: '1234'}).toBuffer()
// //     console.log(buffer)
// //     console.log(new DBusBuffer(buffer).read('a{sv}'))
// })

// const dbsv = new DBusSignedValue('as', ['hello', 'world'])
// const dbsv = new DBusSignedValue('{sv}', {key1: 'value1'})
// const dbsv = new DBusSignedValue("a{sv}", { key1: "value1", key2: "value2" })
// const dbsv = new DBusSignedValue('a{say}', {test: Buffer.from('hahahahah')})
const dbsv = new DBusSignedValue('av', [
    'Hello',
    42,
    true,
    [1, 2, 3],
    {key: 'value'}
])
console.log(JSON.stringify(dbsv, null, 2))

