import {stringify} from 'json5'
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

// const dbsv = DBusSignedValue.parse('as', ['hello', 'world'])
// const dbsv = DBusSignedValue.parse('{sv}', {key1: 'value1'})
// const dbsv = DBusSignedValue.parse("a{sv}", { key1: "value1", key2: "value2" })
// const dbsv = DBusSignedValue.parse('a{say}', {test: Buffer.from('hahahahah')})
// const dbsv = DBusSignedValue.parse('av', [
//     'Hello',
//     42,
//     true,
//     [1, 2, 3],
//     BigInt(123),
//     Buffer.from([2, 3, 4]),
//     {key: 'value'},
//     Uint8Array.from([1, 2, 3]),
//     Int8Array.from([1, 2, 3]),
//     Uint16Array.from([1, 2, 3]),
//     Int16Array.from([1, 2, 3]),
//     BigUint64Array.from([BigInt(1), BigInt(2), BigInt(3)]),
//     BigInt64Array.from([BigInt(1), BigInt(2), BigInt(3)]),
//     {
//         a: 1,
//         b: 'oh',
//         c: true
//     },
//     [
//         {a: 1},
//         {b: 'oh!!!'}
//     ],
//     ['aaa', 'bbbb', 123456, true]
// ])

// const dbsv = DBusSignedValue.parse('aav', [
//     ['string1', 'string2'],
//     [1, 2, 3],
//     [true, false],
//     [['nested1', 42], ['nested2', true]]
// ])

// const dbsv = DBusSignedValue.parse('si', ['abcd', 1234])
// const dbsv = DBusSignedValue.parse('as', ['hello', 'world'])
// const dbsv = DBusSignedValue.parse('as', ['abcd'])
// const dbsv = DBusSignedValue.parse('a{sa{sv}}', {
//     'user1': {
//         'id': 1,
//         'name': 'Alice',
//         'active': true
//     },
//     'user2': {
//         'id': 2,
//         'name': 'Bob',
//         'active': false
//     }
// })
// const dbsv = DBusSignedValue.parse('{sv}', {a:'1234'})
// const dbsv = DBusSignedValue.parse('ssiba{ss}a(ss)', {
//     'name': 'Json.CN',
//     'url': 'http://www.json.cn',
//     'page': 88,
//     'isNonProfit': true,
//     'address': {
//         'street': '科技园路.',
//         'city': '江苏苏州',
//         'country': '中国'
//     },
//     'links': [
//         {'name': 'Google', 'url': 'http://www.google.com'},
//         {'name': 'Baidu', 'url': 'http://www.baidu.com'},
//         {'name': 'SoSo', 'url': 'http://www.SoSo.com'}
//     ]
// })


// console.log(dbsv.$value[12].$value)
// console.log(dbsv.$value[12].$value)
// console.log(JSON.stringify(dbsv, null, 2))
// console.log(stringify(dbsv, null, 2))

