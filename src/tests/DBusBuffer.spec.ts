import {DBusBuffer} from '../lib/DBusBuffer'

function DBusBufferSpecTest(signature: string, data: any): void {
    try {
        console.log('Testing signature:', signature)
        const writer = new DBusBuffer()
        writer.write(signature, data)
        const buffer = writer.toBuffer()
        console.log('Written Buffer Length:', buffer.length)
        console.log('Written Buffer:', buffer)

        const reader = new DBusBuffer(buffer)
        const readData = reader.read(signature)
        console.log('Read Data:', JSON.stringify(readData, null, 2))
    } catch (error: any) {
        console.error('Error:', error.message)
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
        signature: 'a{sa{sv}}',
        data: [
            {
                'user1': {
                    'id': 1,
                    'name': 'Alice',
                    'active': true
                }
            },
            {
                'user2': {
                    'id': 2,
                    'name': 'Bob',
                    'active': false
                }
            }
        ]
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

