import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {DBusSignedValue} from '../../lib/DBusSignedValue'
import {DBusBufferEncoder} from '../../lib/DBusBufferEncoder'
import {DBusBufferDecoder} from '../../lib/DBusBufferDecoder'
import {DBusMessage} from '../../lib/DBusMessage'
import {DBusMessageEndianness} from '../../lib/enums/DBusMessageEndianness'
import {DBusMessageType} from '../../lib/enums/DBusMessageType'
import {InvalidValueError, SignatureError} from '../../lib/Errors'
import {DBusArray} from '../../lib/datatypes/DBusArray'
import {DBusStruct} from '../../lib/datatypes/DBusStruct'
import {DBusDictEntry} from '../../lib/datatypes/DBusDictEntry'
import {DBusVariant} from '../../lib/datatypes/DBusVariant'
import {DBusUInt32} from '../../lib/datatypes/DBusUInt32'
import {DBusInt32} from '../../lib/datatypes/DBusInt32'
import {DBusString} from '../../lib/datatypes/DBusString'
import {DBusObjectPath} from '../../lib/datatypes/DBusObjectPath'
import {DecodeOpts} from '../../types/DecodeOpts'
import {decodeWireMessage} from '../helpers/WireMessage'

const encode = (signature: string, value: any): Buffer => new DBusBufferEncoder().encode(signature, value)
const decode = (signature: string, body: Buffer, opts?: DecodeOpts): any[] => new DBusBufferDecoder(DBusMessageEndianness.LE, body).decode(signature, opts)

/**
 * The bytes a single value is sent as.
 */
const wire = (signature: string, value: any): string => encode(signature, value).toString('hex')

describe('typed values', (): void => {

    describe('DBusSignedValue', (): void => {
        it('tells its complete signature and plain value', (): void => {
            const value: DBusSignedValue = new DBusSignedValue('a{sv}', {mtu: new DBusUInt32(1500), name: 'eth0'})
            assert.equal(value.signature, 'a{sv}')
            assert.deepEqual(value.value, {mtu: 1500, name: 'eth0'})
            assert.equal(new DBusSignedValue('as', []).signature, 'as')
            assert.equal(new DBusUInt32(7).signature, 'u')
            assert.equal(new DBusUInt32(7).value, 7)
        })

        it('publishes only its signature, value, toPlain, inferSignature and a string-signature constructor', (): void => {
            const declaration: string = readFileSync(path.resolve(__dirname, '../../lib/DBusSignedValue.d.ts'), 'utf8')
            assert.doesNotMatch(declaration, /\$signature|\$value|\$arrayItemSignature|static parse|DataType/)
            assert.match(declaration, /constructor\(signature: string, value: any\)/)
        })
    })

    describe('container type classes', (): void => {
        it('reject plain items when constructed, saying what to use instead', (): void => {
            assert.throws((): DBusArray => new DBusArray([1, 2] as any), (error: unknown): boolean => error instanceof InvalidValueError && /at index 0/.test(error.message) && /new DBusSignedValue\('au'/.test(error.message))
            assert.throws((): DBusStruct => new DBusStruct([new DBusString('a'), 1] as any), (error: unknown): boolean => error instanceof InvalidValueError && /field 1/.test(error.message))
            assert.throws((): DBusDictEntry => new DBusDictEntry([new DBusString('k'), 'v'] as any), InvalidValueError)
        })

        it('reject items of different complete types, nested ones included', (): void => {
            assert.throws((): DBusArray => new DBusArray([new DBusUInt32(1), new DBusString('x')]), SignatureError)
            assert.throws((): DBusArray => new DBusArray([new DBusSignedValue('as', ['a']), new DBusSignedValue('ai', [1])]), SignatureError)
        })

        it('reject an empty struct and a dictionary key that is not of a basic type', (): void => {
            assert.throws((): DBusStruct => new DBusStruct([]), SignatureError)
            assert.throws((): DBusDictEntry => new DBusDictEntry([new DBusSignedValue('as', []), new DBusString('v')]), SignatureError)
        })

        it('give an empty array its element type from a class or a signature', (): void => {
            assert.equal(new DBusArray([], DBusString).signature, 'as')
            assert.equal(new DBusArray([], 'a{sv}').signature, 'aa{sv}')
            assert.equal(new DBusArray([]).signature, 'av')
            assert.equal(wire('v', new DBusArray([], 'a{sv}')), wire('v', new DBusSignedValue('aa{sv}', [])))
            assert.throws((): DBusArray => new DBusArray([], 'a'), SignatureError)
        })

        it('expose their contents as typed values', (): void => {
            const array: DBusArray = new DBusArray([new DBusUInt32(1), new DBusUInt32(2)])
            assert.deepEqual(array.items.map((item: DBusSignedValue): number => item.value), [1, 2])
            const struct: DBusStruct = new DBusStruct([new DBusString('a'), new DBusInt32(1)])
            assert.deepEqual(struct.fields.map((field: DBusSignedValue): string => field.signature), ['s', 'i'])
            const entry: DBusDictEntry = new DBusDictEntry([new DBusString('k'), new DBusUInt32(3)])
            assert.deepEqual([entry.key.value, entry.content.signature], ['k', 'u'])
            assert.equal(new DBusVariant(new DBusUInt32(7)).content.signature, 'u')
            assert.equal(new DBusVariant('text').content.signature, 's')
        })

        it('encode like the same value written with a signature', (): void => {
            const classes: DBusArray = new DBusArray([new DBusDictEntry([new DBusString('mtu'), new DBusVariant(new DBusUInt32(1500))])])
            assert.equal(wire('a{sv}', classes), wire('a{sv}', {mtu: new DBusUInt32(1500)}))
        })
    })

    describe('message signatures', (): void => {
        const header = {serial: 1, type: DBusMessageType.SIGNAL, path: '/a', interfaceName: 'org.example.I', member: 'S'}

        it('are taken from the arguments when every one has a type', (): void => {
            const message: DBusMessage = decodeWireMessage(DBusMessage.encode(header, new DBusString('x'), new DBusSignedValue('a{sv}', {n: new DBusUInt32(1)})))
            assert.equal(message.header.signature, 'sa{sv}')
            assert.deepEqual(message.body, ['x', {n: 1}])
        })

        it('are required when an argument is a plain value, instead of the body being dropped', (): void => {
            assert.throws((): Buffer => DBusMessage.encode(header, 'x', 5), (error: unknown): boolean => error instanceof SignatureError && /needs a signature/.test(error.message))
        })
    })

    describe('decode options', (): void => {
        const settings: Buffer = encode('a{sv}', {mtu: new DBusUInt32(1500), ids: new DBusSignedValue('au', [1, 2]), name: 'eth0'})

        it('types none gives plain values', (): void => {
            assert.deepEqual(decode('a{sv}', settings), [{mtu: 1500, ids: [1, 2], name: 'eth0'}])
        })

        it('types variants gives the content of each variant as a type class instance', (): void => {
            const [value] = decode('a{sv}', settings, {types: 'variants'})
            assert.ok(value.mtu instanceof DBusUInt32 && value.ids instanceof DBusArray && value.name instanceof DBusString)
            assert.deepEqual([value.mtu.signature, value.ids.signature, value.ids.value], ['u', 'au', [1, 2]])
        })

        it('types all gives type class instances throughout', (): void => {
            const [value] = decode('a{sv}', settings, {types: 'all'})
            assert.ok(value instanceof DBusArray)
            assert.equal(value.signature, 'a{sv}')
            const mtu: DBusDictEntry = value.items.find((entry: DBusDictEntry): boolean => entry.key.value === 'mtu')
            assert.ok((mtu.content as DBusVariant).content instanceof DBusUInt32)
        })

        it('dictionaries map keeps the types of keys', (): void => {
            assert.deepEqual(decode('a{is}a{bs}a{xs}', encode('a{is}a{bs}a{xs}', [[[1, 'one']], [[true, 'yes']], [[2n ** 40n, 'big']]]), {dictionaries: 'map'}),
                [new Map([[1, 'one']]), new Map([[true, 'yes']]), new Map([[2n ** 40n, 'big']])])
        })

        it('int64 number converts safe integers only', (): void => {
            assert.deepEqual(decode('xtx', encode('xtx', [-5n, 2n ** 53n - 1n, 2n ** 53n]), {int64: 'number'}), [-5, 2 ** 53 - 1, 2n ** 53n])
        })

        it('apply per message through getBody, with the connection defaults in body', (): void => {
            const message: DBusMessage = decodeWireMessage(DBusMessage.encode({serial: 1, type: DBusMessageType.SIGNAL, path: '/a', interfaceName: 'org.example.I', member: 'S', signature: 'x'}, 5n))
            assert.deepEqual(message.body, [5n])
            assert.deepEqual(message.getBody({int64: 'number'}), [5])
            assert.ok(message.getBody({types: 'all'})[0] instanceof DBusSignedValue)
        })
    })

    describe('values received in variants and sent again', (): void => {
        const received: Buffer = encode('a{sv}', {mtu: new DBusUInt32(1500), path: new DBusObjectPath('/a'), empty: new DBusSignedValue('as', []), ratio: new DBusSignedValue('d', 1)})
        const typed = (mtu: DBusSignedValue): string => wire('a{sv}', {mtu, path: new DBusObjectPath('/a'), empty: new DBusSignedValue('as', []), ratio: new DBusSignedValue('d', 1)})

        it('keep their types when sent back unchanged', (): void => {
            const [settings] = decode('a{sv}', received)
            assert.equal(wire('a{sv}', settings), received.toString('hex'))
        })

        it('keep their types when changed in place to a value that fits', (): void => {
            const [settings] = decode('a{sv}', received)
            settings.mtu = 9000
            assert.equal(wire('a{sv}', settings), typed(new DBusUInt32(9000)))
        })

        it('are inferred again when changed to a value that does not fit, or given another type explicitly', (): void => {
            const [settings] = decode('a{sv}', received)
            settings.mtu = 0.5
            assert.equal(wire('a{sv}', settings), typed(new DBusSignedValue('d', 0.5)))
            settings.mtu = new DBusSignedValue('t', 1n)
            assert.equal(wire('a{sv}', settings), typed(new DBusSignedValue('t', 1n)))
            settings.path = 'not a path'
            assert.match(DBusSignedValue.inferSignature(settings.path), /^s$/)
        })

        it('are inferred again in a copy made by spreading the object holding them', (): void => {
            const [settings] = decode('a{sv}', received)
            const copy: Record<string, any> = {...settings}
            assert.notEqual(wire('a{sv}', copy), received.toString('hex'))
        })

        it('keep their types in nested containers when an outer level is copied', (): void => {
            const nested: Buffer = encode('a{sa{sv}}', {ethernet: {mtu: new DBusUInt32(1500)}, ipv4: {dns: new DBusSignedValue('au', [])}})
            const [settings] = decode('a{sa{sv}}', nested)
            assert.equal(wire('a{sa{sv}}', {...settings, extra: {}}), wire('a{sa{sv}}', {ethernet: {mtu: new DBusUInt32(1500)}, ipv4: {dns: new DBusSignedValue('au', [])}, extra: {}}))
        })

        it('keep their types in Maps, arrays of variants, structs and argument lists', (): void => {
            for (const [signature, values] of [
                ['a{iv}', [new Map<number, any>([[1, new DBusUInt32(1)], [2, new DBusObjectPath('/b')]])]],
                ['av', [[new DBusUInt32(1), new DBusSignedValue('y', 2)]]],
                ['(sv)', [['k', new DBusSignedValue('q', 3)]]],
                ['vv', [new DBusUInt32(1), new DBusSignedValue('aau', [[1]])]]
            ] as [string, any[]][]) {
                const body: Buffer = encode(signature, values.length > 1 ? values : values[0])
                for (const opts of [{}, {dictionaries: 'map'}] as DecodeOpts[]) {
                    const decoded: any[] = decode(signature, body, opts)
                    assert.equal(wire(signature, decoded.length > 1 ? decoded : decoded[0]), body.toString('hex'), `${signature} ${JSON.stringify(opts)}`)
                }
            }
        })

        it('keep their types with types variants even in a spread copy', (): void => {
            const [settings] = decode('a{sv}', received, {types: 'variants'})
            assert.equal(wire('a{sv}', {...settings}), received.toString('hex'))
        })
    })
})
