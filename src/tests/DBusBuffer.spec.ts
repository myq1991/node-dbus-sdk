import {DBusBufferEncoder} from '../lib/DBusBufferEncoder'
import {stringify} from 'json5'
import {DBusBufferDecoder} from '../lib/DBusBufferDecoder'
import {DBusMessageEndianness} from '../lib/DBusMessageEndianness'
import {DBusSignedValue} from '../lib/DBusSignedValue'

const endianness: DBusMessageEndianness = DBusMessageEndianness.LE

function DBusBufferSpecTest(signature: string, data: any): void {
    console.log('Test signature:', signature)
    const encoder = new DBusBufferEncoder(endianness)
    const encodeBuffer: Buffer = encoder.encode(signature, data)
    console.log('encodeBuffer:', stringify(Array.from(encodeBuffer)), 'length:', encodeBuffer.length)
    const decoder = new DBusBufferDecoder(endianness, encodeBuffer)
    // console.log(stringify(decoder.read(signature), null, 2))
    console.log(stringify(decoder.decode(signature), null, 2))
}

const TestSet: { signature: string, data: any }[] = [
    // {signature: 'i', data: 1},
    // {signature: 'b', data: true},
    // {signature: 'ib', data: [1, true]},
    // {
    //     signature: 'a(yv)',
    //     data: [
    //         [1, new DBusSignedValue('o', '/slot1/port1/stc')],
    //         [2, 'pad.stc'],
    //         [3, 'portGetSpeed'],
    //         [6, 'org.ptswitch.pad']
    //     ]
    // }
    {
        signature: 'a{say}',
        data: {test: Buffer.from('hahahahah')}
    },
    // {
    //     signature: 'av',
    //     data: [
    //         'Hello',
    //         42,
    //         true,
    //         [1, 2, 3],
    //         // {key: 'value'}
    //         {key: 12345, key2: 67890}
    //         // {key: 'value',key2:123}
    //     ]
    // },
    // {
    //     signature: 'av',
    //     data: [
    //         'Hello',
    //         42,
    //         true,
    //         [1, 2, 3],
    //         // {key: 'value'}
    //         new DBusSignedValue('a{si}',{key: 12345, key2: 67890})
    //         // {key: 'value',key2:123}
    //     ]
    // },
    // {
    //     signature: 'aav',
    //     data: [
    //         ['string1', 'string2'],
    //         [1, 2, 3],
    //         [true, false],
    //         [['nested1', 42], ['nested2', true]]
    //     ]
    // },
    // {
    //     signature: 'si',
    //     data: ['abcd', 1234]
    // },
    // {
    //     signature: 'as',
    //     data: ['abcd']
    // },
    // {
    //     signature: 'a{sa{sv}}',
    //     data: {
    //         'user1': {
    //             'id': 1,
    //             'name': 'Alice',
    //             'active': true
    //         },
    //         'user2': {
    //             'id': 2,
    //             'name': 'Bob',
    //             'active': false
    //         }
    //     }
    // },
    // {
    //     signature: 'a{sv}',
    //     data: {
    //         a: 1,
    //         b: true,
    //         c: 'abcd',
    //         d: [1, 2, 3, 4, 5, 'aa', true]
    //     }
    // },
    // {
    //     signature: 'ssiba{ss}a(ss)',
    //     data: {
    //         'name': 'Json.CN',
    //         'url': 'http://www.json.cn',
    //         'page': 88,
    //         'isNonProfit': true,
    //         'address': {
    //             'street': '科技园路.',
    //             'city': '江苏苏州',
    //             'country': '中国'
    //         },
    //         'links': [
    //             {'name': 'Google', 'url': 'http://www.google.com'},
    //             {'name': 'Baidu', 'url': 'http://www.baidu.com'},
    //             {'name': 'SoSo', 'url': 'http://www.SoSo.com'}
    //         ]
    //     }
    // }
]

export function runDBusBufferTestSet(): void {
    TestSet.forEach(testData => DBusBufferSpecTest(testData.signature, testData.data))
}
