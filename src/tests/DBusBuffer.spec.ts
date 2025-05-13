import {DBusBuffer} from '../lib/DBusBuffer'

function DBusBufferSpecTest(signature: string, data: any): void {
    try {
        console.log('Testing signature:', signature)
        const writer = new DBusBuffer()
        writer.write(signature, data)
        const buffer = writer.toBuffer()
        console.log('Written Buffer Length:', buffer.length)
        console.log('Written Buffer:', buffer)
        console.log('Written stringify buffer:', JSON.stringify(Array.from(buffer)))

        const reader = new DBusBuffer(buffer)
        const readData = reader.read(signature)
        console.log('Read Data:', JSON.stringify(readData, null, 2))
    } catch (error: any) {
        console.error('Error:', error)
    } finally {
        console.log('\n')
    }
}

const TestSet: { signature: string, data: any }[] = [
    {signature: 'i', data: 1},
    {signature: 'b', data: true},
    {
        signature: 'a{say}',
        data: {test: Buffer.from('hahahahah')}
    },
    {
        signature: 'av',
        data: [
            'Hello',
            42,
            true,
            [1, 2, 3],
            {key: 'value'}
        ]
    },
    {
        signature: 'aav',
        data: [
            ['string1', 'string2'],
            [1, 2, 3],
            [true, false],
            [['nested1', 42], ['nested2', true]]
        ]
    },
    {
        signature: 'si',
        data: ['abcd', 1234]
    },
    {
        signature: 'as',
        data: ['abcd']
    },
    {
        signature: 'a{sa{sv}}',
        data: {
            'user1': {
                'id': 1,
                'name': 'Alice',
                'active': true
            },
            'user2': {
                'id': 2,
                'name': 'Bob',
                'active': false
            }
        }
    },
    {
        signature: 'a{sv}',
        data: {
            a: 1,
            b: true,
            c: 'abcd',
            d: [1, 2, 3, 4, 5, 'aa', true]
        }
    },
    {
        signature: 'ssiba{ss}a(ss)',
        data: {
            'name': 'Json.CN',
            'url': 'http://www.json.cn',
            'page': 88,
            'isNonProfit': true,
            'address': {
                'street': '科技园路.',
                'city': '江苏苏州',
                'country': '中国'
            },
            'links': [
                {'name': 'Google', 'url': 'http://www.google.com'},
                {'name': 'Baidu', 'url': 'http://www.baidu.com'},
                {'name': 'SoSo', 'url': 'http://www.SoSo.com'}
            ]
        }
    }
]

export function runDBusBufferTestSet(): void {
    TestSet.forEach(testData => DBusBufferSpecTest(testData.signature, testData.data))
}

export function runDBusBufferReadArrayTestSet() {
    // const rawBuf: Buffer = Buffer.from([6, 1, 115, 0, 5, 0, 0, 0, 58, 49, 46, 55, 51, 0, 0, 0, 5, 1, 117, 0, 1, 0, 0, 0, 8, 1, 103, 0, 1, 115, 0, 0, 7, 1, 115, 0, 20, 0, 0, 0, 111, 114, 103, 46, 102, 114, 101, 101, 100, 101, 115, 107, 116, 111, 112, 46, 68, 66, 117, 115, 0, 0, 0, 0, 5, 0, 0, 0, 58, 49, 46, 55, 51, 0])
    // const eleType = {
    //     type: '(',
    //     child: [{type: 'y', child: []}, {type: 'v', child: []}]
    // }
    //
    // new DBusBuffer(rawBuf).readArray(eleType as any,71)


    const rawBuf: Buffer = Buffer.from([108, 2, 1, 1, 10, 0, 0, 0, 1, 0, 0, 0, 61, 0, 0, 0, 6, 1, 115, 0, 5, 0, 0, 0, 58, 49, 46, 55, 57, 0, 0, 0, 5, 1, 117, 0, 1, 0, 0, 0, 8, 1, 103, 0, 1, 115, 0, 0, 7, 1, 115, 0, 20, 0, 0, 0, 111, 114, 103, 46, 102, 114, 101, 101, 100, 101, 115, 107, 116, 111, 112, 46, 68, 66, 117, 115, 0, 0, 0, 0, 5, 0, 0, 0, 58, 49, 46, 55, 57, 0])
    const reader = new DBusBuffer(rawBuf)

    const message = reader.readMessage()
    console.log('Parsed Message:', JSON.stringify(message, null, 2))

// // 解析消息头的基本字段
//     const endianness = reader.readInt8() // 字节序，0x6C ('l') 表示小端序
//     const messageType = reader.readInt8() // 消息类型，0x02 (METHOD_RETURN)
//     const flags = reader.readInt8() // 标志，0x01
//     const protocolVersion = reader.readInt8() // 协议版本，0x01
//     const bodyLength = reader.readInt32() // 消息体长度，10 字节
//     const serial = reader.readInt32() // 序列号，1
//     const headerFieldsLength = reader.readInt32() // 头部字段数组长度，61 字节
//
//     console.log('Header Info:', {
//         endianness: String.fromCharCode(endianness),
//         messageType,
//         flags,
//         protocolVersion,
//         bodyLength,
//         serial,
//         headerFieldsLength
//     })
//
// // 读取头部字段数组 (a(yv))
//     const headerFields = reader.readArray(
//         {type: '(', child: [{type: 'y', child: []}, {type: 'v', child: []}]},
//         headerFieldsLength
//     )
//     console.log('Header Fields:', JSON.stringify(headerFields, null, 2))
}
