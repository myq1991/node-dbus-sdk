import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBusBufferEncoder} from '../../lib/DBusBufferEncoder'
import {DBusBufferDecoder} from '../../lib/DBusBufferDecoder'
import {DBusMessageEndianness} from '../../lib/enums/DBusMessageEndianness'
import {DBusTypeClass} from '../../lib/DBusTypeClass'
import {DBusByte} from '../../lib/datatypes/DBusByte'
import {DBusBoolean} from '../../lib/datatypes/DBusBoolean'
import {DBusInt16} from '../../lib/datatypes/DBusInt16'
import {DBusUint16} from '../../lib/datatypes/DBusUint16'
import {DBusInt32} from '../../lib/datatypes/DBusInt32'
import {DBusUint32} from '../../lib/datatypes/DBusUint32'
import {DBusInt64} from '../../lib/datatypes/DBusInt64'
import {DBusUint64} from '../../lib/datatypes/DBusUint64'
import {DBusDouble} from '../../lib/datatypes/DBusDouble'
import {DBusUnixFD} from '../../lib/datatypes/DBusUnixFD'
import {DBusString} from '../../lib/datatypes/DBusString'
import {DBusObjectPath} from '../../lib/datatypes/DBusObjectPath'
import {DBusSignature} from '../../lib/datatypes/DBusSignature'
import {DBusArray} from '../../lib/datatypes/DBusArray'
import {DBusStruct} from '../../lib/datatypes/DBusStruct'
import {DBusDictEntry} from '../../lib/datatypes/DBusDictEntry'
import {DBusVariant} from '../../lib/datatypes/DBusVariant'
import {loadWireMatrix, MatrixCase, toExpected, WireMatrix} from '../helpers/TaggedValue'

const matrix: WireMatrix = loadWireMatrix()

type TypeClassConstructor = new (...args: any[]) => DBusTypeClass

function matrixCase(id: string): MatrixCase {
    const found: MatrixCase | undefined = matrix.cases.find((testCase: MatrixCase): boolean => testCase.id === id)
    if (!found) throw new Error(`No matrix case ${id}`)
    return found
}

interface TypeClassCase {
    name: string
    /**
     * GDBus reference case whose single argument the instance represents.
     */
    caseId: string
    create: () => DBusTypeClass
    /**
     * The class the typed decoder should produce for the case's signature, checked recursively through `children`.
     */
    decodedClass: TypeClassConstructor
    children?: (decoded: DBusTypeClass) => [DBusTypeClass, TypeClassConstructor][]
}

const CASES: TypeClassCase[] = [
    {name: 'DBusByte', caseId: 'basic: y [byte 0xff]', create: (): DBusTypeClass => new DBusByte(255), decodedClass: DBusByte},
    {name: 'DBusBoolean', caseId: 'basic: b [true]', create: (): DBusTypeClass => new DBusBoolean(true), decodedClass: DBusBoolean},
    {name: 'DBusInt16', caseId: 'basic: n [int16 -32768]', create: (): DBusTypeClass => new DBusInt16(-32768), decodedClass: DBusInt16},
    {name: 'DBusUint16', caseId: 'basic: q [uint16 65535]', create: (): DBusTypeClass => new DBusUint16(65535), decodedClass: DBusUint16},
    {name: 'DBusInt32', caseId: 'basic: i [-2147483648]', create: (): DBusTypeClass => new DBusInt32(-2147483648), decodedClass: DBusInt32},
    {name: 'DBusUint32', caseId: 'basic: u [uint32 4294967295]', create: (): DBusTypeClass => new DBusUint32(4294967295), decodedClass: DBusUint32},
    {name: 'DBusInt64', caseId: 'basic: x [int64 -9223372036854775808]', create: (): DBusTypeClass => new DBusInt64(-(2n ** 63n)), decodedClass: DBusInt64},
    {name: 'DBusUint64', caseId: 'basic: t [uint64 18446744073709551615]', create: (): DBusTypeClass => new DBusUint64(2n ** 64n - 1n), decodedClass: DBusUint64},
    {name: 'DBusDouble', caseId: 'basic: d [1.5]', create: (): DBusTypeClass => new DBusDouble(1.5), decodedClass: DBusDouble},
    {name: 'DBusUnixFD', caseId: 'basic: h [handle 3]', create: (): DBusTypeClass => new DBusUnixFD(3), decodedClass: DBusUnixFD},
    {name: 'DBusString', caseId: 'basic: s [\'hello world\']', create: (): DBusTypeClass => new DBusString('hello world'), decodedClass: DBusString},
    {name: 'DBusObjectPath', caseId: 'basic: o [objectpath \'/a\']', create: (): DBusTypeClass => new DBusObjectPath('/a'), decodedClass: DBusObjectPath},
    {name: 'DBusSignature', caseId: 'basic: g [signature \'a{sv}\']', create: (): DBusTypeClass => new DBusSignature('a{sv}'), decodedClass: DBusSignature},
    {
        name: 'DBusArray',
        caseId: 'array: ai #2',
        create: (): DBusTypeClass => new DBusArray([new DBusInt32(-4), new DBusInt32(70000)]),
        decodedClass: DBusArray,
        children: (decoded: DBusTypeClass): [DBusTypeClass, TypeClassConstructor][] => decoded.$value.map((item: DBusTypeClass): [DBusTypeClass, TypeClassConstructor] => [item, DBusInt32])
    },
    {
        name: 'DBusArray (empty)',
        caseId: 'array: ai [empty]',
        // The subclasses' constructors are not assignable to `typeof DBusTypeClass`, so callers have to cast
        create: (): DBusTypeClass => new DBusArray([], DBusInt32 as unknown as typeof DBusTypeClass),
        decodedClass: DBusArray
    },
    {
        name: 'DBusStruct',
        caseId: 'struct: (yx)',
        create: (): DBusTypeClass => new DBusStruct([new DBusByte(1), new DBusInt64(-6n)]),
        decodedClass: DBusStruct,
        children: (decoded: DBusTypeClass): [DBusTypeClass, TypeClassConstructor][] => [[decoded.$value[0], DBusByte], [decoded.$value[1], DBusInt64]]
    },
    {
        name: 'DBusDictEntry',
        caseId: 'dict: a{su}',
        create: (): DBusTypeClass => new DBusArray([
            new DBusDictEntry([new DBusString('first'), new DBusUint32(5)]),
            new DBusDictEntry([new DBusString('second'), new DBusUint32(4294967295)])
        ]),
        decodedClass: DBusArray,
        children: (decoded: DBusTypeClass): [DBusTypeClass, TypeClassConstructor][] => decoded.$value.map((item: DBusTypeClass): [DBusTypeClass, TypeClassConstructor] => [item, DBusDictEntry])
    },
    {
        name: 'DBusVariant',
        caseId: 'variant: v [u]',
        create: (): DBusTypeClass => new DBusVariant(new DBusUint32(5)),
        decodedClass: DBusVariant,
        children: (decoded: DBusTypeClass): [DBusTypeClass, TypeClassConstructor][] => [[decoded.$value, DBusUint32]]
    }
]

describe('DBusTypeClass subclasses', (): void => {
    for (const typeClassCase of CASES) {
        describe(typeClassCase.name, (): void => {
            const reference: MatrixCase = matrixCase(typeClassCase.caseId)

            it(`encodes like GDBus (${reference.id})`, (): void => {
                assert.equal(new DBusBufferEncoder().encode(reference.signature, typeClassCase.create()).toString('hex'), reference.le)
            })

            it('exposes the plain value through .value', (): void => {
                assert.deepEqual(typeClassCase.create().value, toExpected(reference.args)[0])
            })

            it('is produced by the typed decoder', (): void => {
                const [decoded] = new DBusBufferDecoder(DBusMessageEndianness.LE, Buffer.from(reference.le, 'hex')).decode(reference.signature, true)
                assert.ok(decoded instanceof typeClassCase.decodedClass, `expected ${typeClassCase.decodedClass.name}, got ${decoded?.constructor?.name}`)
                for (const [child, childClass] of typeClassCase.children ? typeClassCase.children(decoded) : []) {
                    assert.ok(child instanceof childClass, `expected ${childClass.name}, got ${(child as any)?.constructor?.name}`)
                }
                assert.deepEqual(decoded.value, toExpected(reference.args)[0])
            })
        })
    }

    it('rejects array items of different types', (): void => {
        assert.throws((): DBusArray => new DBusArray([new DBusInt32(1), new DBusString('a')]))
    })

    it('can be passed where a variant is expected', (): void => {
        assert.equal(new DBusBufferEncoder().encode('v', new DBusUint32(5)).toString('hex'), matrixCase('variant: v [u]').le)
    })
})
