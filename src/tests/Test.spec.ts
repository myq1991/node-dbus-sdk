import {stringify} from 'json5'
import {DBus} from '../DBus'
import {DBusBuffer} from '../lib/DBusBuffer'
import {runDBusBufferTestSet} from './DBusBuffer.spec'
import {DBusSignedValue} from '../lib/DBusSignedValue'
import {DBusBufferEncoder} from '../lib/DBusBufferEncoder'
import {DBusMessageEndianness} from '../lib/DBusMessageEndianness'
import {DBusBufferDecoder} from '../lib/DBusBufferDecoder'

// runDBusBufferTestSet()

setImmediate(async (): Promise<void> => {
    const dbus=await DBus.connect({busAddress: 'tcp:host=192.168.1.236,port=44444'})
    console.log('success')
    dbus.write()
//     // const dbuf = new DBusBuffer()
//     // const data = `{"name":"Json.CN","url":"http://www.json.cn","page":88,"isNonProfit":true,"address":{"street":"科技园路.","city":"江苏苏州","country":"中国"},"links":[{"name":"Google","url":"http://www.google.com"},{"name":"Baidu","url":"http://www.baidu.com"},{"name":"SoSo","url":"http://www.SoSo.com"}]}`
//     //
//     // const buffer=new DBusBuffer().write('ssib(sss)a(ss)', JSON.parse(`{"name":"Json.CN","url":"http://www.json.cn","page":88,"isNonProfit":true,"address":{"street":"科技园路.","city":"江苏苏州","country":"中国"},"links":[{"name":"Google","url":"http://www.google.com"},{"name":"Baidu","url":"http://www.baidu.com"},{"name":"SoSo","url":"http://www.SoSo.com"}]}`)).toBuffer()
//     const buffer = new DBusBuffer().write('a{sv}', {a: true, b: 1, c: '1234'}).toBuffer()
//     console.log(buffer)
//     console.log(new DBusBuffer(buffer).read('a{sv}'))
})

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
// const dbsv = DBusSignedValue.parse('v', ['abcd'])
// const dbsv = DBusSignedValue.parse('{sv}', {a:'1234'})
// const dbsv = DBusSignedValue.parse('(sv)', ['a',1234])
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
//

// const dbsv = DBusSignedValue.parse('a(yv)', [
//     [1, new DBusSignedValue('o', '/org/freedesktop/DBus')],
//     [2, 'org.freedesktop.DBus'],
//     [3, 'Hello'],
//     [6, 'org.freedesktop.DBus']
// ])
//
// console.log(stringify(dbsv, null, 2))

// // console.log(dbsv.$value[12].$value)
// // console.log(dbsv.$value[12].$value)
// // console.log(JSON.stringify(dbsv, null, 2))
//
// //
// const encoder = new DBusBufferEncoder()
// // // // // const encodeBuf = encoder.encode('i(ii)', [123, [456, 789]])
// // // const encodeBuf = encoder.encode('a(yv)', [
// // //     [1, new DBusSignedValue('o', '/org/freedesktop/DBus')],
// // //     [2, 'org.freedesktop.DBus'],
// // //     [3, 'Hello'],
// // //     [6, 'org.freedesktop.DBus']
// // // ])
//
// const encodeBuf = encoder.encode('a(yv)', [
//     [1, new DBusSignedValue('o', '/slot1/port1/stc')],
//     [2, 'pad.stc'],
//     [3, 'portGetSpeed'],
//     [6, 'org.ptswitch.pad']
// ])
// console.log(stringify(Array.from(encodeBuf)), encodeBuf.length)
// const decoder = new DBusBufferDecoder(DBusMessageEndianness.LE, encodeBuf)
// console.log(decoder.read('a(yv)'))
// console.log(decoder.decode('a(yv)'))

// console.log(stringify(Array.from(encodeBuf)), encodeBuf.length)

// const headerEncoder = new DBusBufferEncoder(DBusMessageEndianness.LE)
// const header = headerEncoder.encode('yyyyuu', [
//     108,
//     1,
//     0,
//     1,
//     0,
//     1
// ])
// console.log(stringify(Array.from(header)), header.length)

//6c 01 00 01 | 00 00 00 00 | 01 00 00 00
//
// // const fieldsEncoder1 = new DBusBufferEncoder(headerEncoder.endianness, header)
// const fieldsEncoder2 = new DBusBufferEncoder()
//
// // const all=fieldsEncoder1.encode('a(yv)', [
// //     [1, new DBusSignedValue('o', '/org/freedesktop/DBus')],
// //     [2, 'org.freedesktop.DBus'],
// //     [3, 'Hello'],
// //     [6, 'org.freedesktop.DBus']
// // ])
//
// const part=fieldsEncoder2.encode('a(yv)', [
//     [1, new DBusSignedValue('o', '/org/freedesktop/DBus')],
//     [2, 'org.freedesktop.DBus'],
//     [3, 'Hello'],
//     [6, 'org.freedesktop.DBus']
// ])
//
// // console.log(stringify(Array.from(all)),all.length)
// console.log(stringify(Array.from(part)),part.length)
