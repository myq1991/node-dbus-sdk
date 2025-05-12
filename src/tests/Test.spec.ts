import {DBus} from '../DBus'
import {DBusBuffer} from '../lib/DBusBuffer'
import {runDBusBufferTestSet} from './DBusBuffer.spec'

// runDBusBufferTestSet()

// setImmediate(async (): Promise<void> => {
//     // await DBus.connect({busAddress: 'tcp:host=192.168.1.236,port=44444'})
//     // console.log('success')
//     // const dbuf = new DBusBuffer()
//     // const data = `{"name":"Json.CN","url":"http://www.json.cn","page":88,"isNonProfit":true,"address":{"street":"科技园路.","city":"江苏苏州","country":"中国"},"links":[{"name":"Google","url":"http://www.google.com"},{"name":"Baidu","url":"http://www.baidu.com"},{"name":"SoSo","url":"http://www.SoSo.com"}]}`
//     //
//     // const buffer=new DBusBuffer().write('ssib(sss)a(ss)', JSON.parse(`{"name":"Json.CN","url":"http://www.json.cn","page":88,"isNonProfit":true,"address":{"street":"科技园路.","city":"江苏苏州","country":"中国"},"links":[{"name":"Google","url":"http://www.google.com"},{"name":"Baidu","url":"http://www.baidu.com"},{"name":"SoSo","url":"http://www.SoSo.com"}]}`)).toBuffer()
//     const buffer = new DBusBuffer().write('a{sv}', {a: true, b: 1, c: '1234'}).toBuffer()
//     console.log(buffer)
//     console.log(new DBusBuffer(buffer).read('a{sv}'))
// })
