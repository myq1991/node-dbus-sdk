import {default as put} from '@homebridge/put'
import {default as Long} from '@homebridge/long'
import {Writable} from 'stream'
import {IType} from '../types/IType'
import {Signature} from './Signature'

interface Put {
    _offset: number;

    put(buf: Buffer): this;

    word8(x: number): this;

    floatle(x: number): this;

    word8be(x: number): this;

    word8le(x: number): this;

    word16be(x: number): this;

    word16le(x: number): this;

    word24be(x: number): this;

    word24le(x: number): this;

    word32be(x: number): this;

    word32le(x: number): this;

    word64be(x: number): this;

    word64le(x: number): this;

    pad(bytes: number): this;

    length(): number;

    buffer(): Buffer;

    write(stream: Writable): void;
}

export function marshall(signature: string, data: any, offset?: number): Buffer {
    if (typeof offset === 'undefined') offset = 0
    let tree: IType[] = Signature.parseSignature(signature)
    // Uncomment for debugging signature tree
    // console.log('Signature Tree:', JSON.stringify(tree, null, 2));
    // Validate input data length matches signature expectations
    if (!Array.isArray(data) && tree.length === 1) {
        // Allow single object/array if signature expects one item
        data = [data]
    }
    if (!Array.isArray(data) || data.length !== tree.length) {
        throw new Error(
            `message body does not match message signature. Body:${JSON.stringify(
                data
            )}, signature:${signature}`
        )
    }
    let putstream: Put = put()
    putstream._offset = offset
    return writeStruct(putstream, tree, data).buffer()
}

function align(ps: Put, n: number) {
    let pad = n - ps._offset % n
    if (pad === 0 || pad === n) return
    let padBuff = Buffer.alloc(pad)
    ps.put(Buffer.from(padBuff))
    ps._offset += pad
}

function writeStruct(ps: Put, tree: IType[], data: any) {
    if (tree.length !== data.length) {
        console.error('Invalid struct data - Mismatch detected:', {
            treeLength: tree.length,
            dataLength: data.length,
            tree: JSON.stringify(tree, null, 2),
            data: JSON.stringify(data, null, 2)
        })
        throw new Error('Invalid struct data')
    }
    for (let i = 0; i < tree.length; ++i) {
        write(ps, tree[i], data[i])
    }
    return ps
}

function writeHash(ps: Put, treeKey: IType, treeVal: IType, data: Record<string, any>) {
    // Handle dictionary (e.g., {sv} for string key and variant value)
    // Data should be an object with string keys
    if (typeof data !== 'object' || data === null) {
        throw new Error('Dictionary data must be an object')
    }

    const entries = Object.entries(data)
    for (const [key, value] of entries) {
        // Write key (string for {sv})
        write(ps, treeKey, key)
        // Write value (variant for {sv}), infer signature if value is not in [signature, value] format
        let variantValue = value
        if (!Array.isArray(value)) {
            variantValue = inferVariantValue(value)
        }
        write(ps, treeVal, variantValue)
    }
    return ps
}

// Helper function to infer DBus variant signature from native JS value
function inferVariantValue(value: any): [string, any] {
    if (typeof value === 'string') {
        return ['s', value]
    } else if (typeof value === 'boolean') {
        return ['b', value ? 1 : 0]
    } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
            if (value >= 0 && value <= 0xffffffff) {
                return ['u', value]
            } else {
                return ['x', value] // Use 64-bit for larger or negative integers
            }
        } else {
            return ['d', value] // Double for floating-point
        }
    } else if (Array.isArray(value)) {
        // Basic support for arrays - assume array of bytes if Buffer, otherwise throw
        throw new Error('Arrays in variants are not automatically inferred yet, except for Buffer')
    } else if (Buffer.isBuffer(value)) {
        // Handle Buffer as array of bytes (ay)
        return ['ay', value]
    } else if (typeof value === 'object' && value !== null) {
        throw new Error('Objects in variants are not automatically inferred yet')
    } else {
        throw new Error(`Unsupported type for variant inference: ${typeof value}`)
    }
}

function write(ps: Put, ele: IType, data: any) {
    switch (ele.type) {
        case '(':
        case '{':
            align(ps, 8)
            if (ele.type === '{') {
                // Dictionary (key-value pairs)
                if (!ele.child || ele.child.length !== 2) {
                    throw new Error('Dictionary signature must have exactly 2 children (key and value)')
                }
                writeHash(ps, ele.child[0], ele.child[1], data)
            } else {
                // Struct
                writeStruct(ps, ele.child!, data)
            }
            break
        case 'a':
            // Array serialisation:
            let arrPut = put()
            arrPut._offset = ps._offset
            let _offset = arrPut._offset
            writeSimple(arrPut, 'u', 0) // Array length placeholder
            let lengthOffset = arrPut._offset - 4 - _offset
            // Align if first body element needs 8-byte alignment
            if (ele.child && ele.child.length > 0 && ['x', 't', 'd', '{', '('].indexOf(ele.child[0].type) !== -1) {
                align(arrPut, 8)
            }
            let startOffset = arrPut._offset
            for (let i = 0; i < data.length; ++i) {
                write(arrPut, ele.child![0], data[i])
            }
            let arrBuff = arrPut.buffer()
            let length = arrPut._offset - startOffset
            arrBuff.writeUInt32LE(length, lengthOffset)
            ps.put(arrBuff)
            ps._offset += arrBuff.length
            break
        case 'v':
            // Variant serialization: Write signature and then the data
            // If data is a simple type (not an array of [signature, value]), infer the signature
            if (!Array.isArray(data)) {
                data = inferVariantValue(data)
            }
            if (data.length !== 2) {
                throw new Error('Variant data should be [signature, data]')
            }
            let signatureEle = {
                type: 'g',
                child: []
            }
            write(ps, signatureEle as IType, data[0])
            let tree = Signature.parseSignature(data[0])
            if (tree.length !== 1) {
                throw new Error('Variant data should contain exactly 1 item')
            }
            write(ps, tree[0], data[1])
            break
        default:
            return writeSimple(ps, ele.type, data)
    }
    return ps
}

let stringTypes = ['g', 'o', 's']

function writeSimple(ps: Put, type: string, data: any) {
    if (typeof data === 'undefined') {
        throw new Error('Serialisation of JS \'undefined\' type is not supported by d-bus')
    }
    if (data === null) {
        throw new Error('Serialisation of null value is not supported by d-bus')
    }

    if (Buffer.isBuffer(data)) data = data.toString()
    if (stringTypes.indexOf(type) !== -1 && typeof data !== 'string') {
        throw new Error(
            `Expected string or buffer argument, got ${JSON.stringify(
                data
            )} of type '${type}'`
        )
    }

    let simpleMarshaller = MakeSimpleMarshaller(type)
    simpleMarshaller.marshall(ps, data)
    return ps
}

/**
 * MakeSimpleMarshaller
 * @param signature - the signature of the data you want to check
 * @returns a simple marshaller with the "check" and "marshall" methods
 */
export function MakeSimpleMarshaller(signature: string) {
    let marshaller: any = {}

    function checkValidString(data: any) {
        if (typeof data !== 'string') {
            throw new Error(`Data: ${data} was not of type string`)
        } else if (data.indexOf('\0') !== -1) {
            throw new Error('String contains null byte')
        }
    }

    function checkValidSignature(data: string) {
        if (data.length > 0xff) {
            throw new Error(
                `Data: ${data} is too long for signature type (${data.length} > 255)`
            )
        }

        let parenCount = 0
        for (let ii = 0; ii < data.length; ++ii) {
            if (parenCount > 32) {
                throw new Error(
                    `Maximum container type nesting exceeded in signature type:${data}`
                )
            }
            switch (data[ii]) {
                case '(':
                    ++parenCount
                    break
                case ')':
                    --parenCount
                    break
                default:
                    /* no-op */
                    break
            }
        }
        Signature.parseSignature(data)
    }

    function checkValidObjectPath(data: string) {
        checkValidString(data)
        if (data !== '/' && !data.match(/^\/[A-Za-z0-9_]+(\/[A-Za-z0-9_]+)*$/)) {
            throw new Error(`Invalid object path: ${data}`)
        }
    }

    switch (signature) {
        case 'o':
            marshaller.check = function (data: string) {
                checkValidObjectPath(data)
            }
            marshaller.marshall = function (ps: Put, data: string) {
                this.check(data)
                align(ps, 4)
                const buff = Buffer.from(data, 'utf8')
                ps.word32le(buff.length).put(buff).word8(0)
                ps._offset += 5 + buff.length
            }
            break
        case 's':
            marshaller.check = function (data: string) {
                checkValidString(data)
            }
            marshaller.marshall = function (ps: Put, data: string) {
                this.check(data)
                align(ps, 4)
                const buff = Buffer.from(data, 'utf8')
                ps.word32le(buff.length).put(buff).word8(0)
                ps._offset += 5 + buff.length
            }
            break
        case 'g':
            marshaller.check = function (data: string) {
                checkValidString(data)
                checkValidSignature(data)
            }
            marshaller.marshall = function (ps: Put, data: string) {
                this.check(data)
                const buff = Buffer.from(data, 'ascii')
                ps.word8(data.length).put(buff).word8(0)
                ps._offset += 2 + buff.length
            }
            break
        case 'y':
            marshaller.check = function (data: number) {
                checkInteger(data)
                checkRange(0x00, 0xff, data)
            }
            marshaller.marshall = function (ps: Put, data: number) {
                this.check(data)
                ps.word8(data)
                ps._offset++
            }
            break
        case 'b':
            marshaller.check = function (data: boolean | number) {
                checkBoolean(data)
            }
            marshaller.marshall = function (ps: Put, data: boolean | number) {
                this.check(data)
                data = data ? 1 : 0
                align(ps, 4)
                ps.word32le(data)
                ps._offset += 4
            }
            break
        case 'n':
            marshaller.check = function (data: number) {
                checkInteger(data)
                checkRange(-0x7fff - 1, 0x7fff, data)
            }
            marshaller.marshall = function (ps: Put, data: number) {
                this.check(data)
                align(ps, 2)
                const buff = Buffer.alloc(2)
                buff.writeInt16LE(parseInt(data.toString()), 0)
                ps.put(buff)
                ps._offset += 2
            }
            break
        case 'q':
            marshaller.check = function (data: number) {
                checkInteger(data)
                checkRange(0, 0xffff, data)
            }
            marshaller.marshall = function (ps: Put, data: number) {
                this.check(data)
                align(ps, 2)
                ps.word16le(data)
                ps._offset += 2
            }
            break
        case 'i':
            marshaller.check = function (data: number) {
                checkInteger(data)
                checkRange(-0x7fffffff - 1, 0x7fffffff, data)
            }
            marshaller.marshall = function (ps: Put, data: number) {
                this.check(data)
                align(ps, 4)
                const buff = Buffer.alloc(4)
                buff.writeInt32LE(parseInt(data.toString()), 0)
                ps.put(buff)
                ps._offset += 4
            }
            break
        case 'u':
            marshaller.check = function (data: number) {
                checkInteger(data)
                checkRange(0, 0xffffffff, data)
            }
            marshaller.marshall = function (ps: Put, data: number) {
                this.check(data)
                align(ps, 4)
                ps.word32le(data)
                ps._offset += 4
            }
            break
        case 't':
            marshaller.check = function (data: any) {
                return checkLong(data, false)
            }
            marshaller.marshall = function (ps: Put, data: any) {
                data = this.check(data)
                align(ps, 8)
                ps.word32le(data.low).word32le(data.high)
                ps._offset += 8
            }
            break
        case 'x':
            marshaller.check = function (data: any) {
                return checkLong(data, true)
            }
            marshaller.marshall = function (ps: Put, data: any) {
                data = this.check(data)
                align(ps, 8)
                ps.word32le(data.low).word32le(data.high)
                ps._offset += 8
            }
            break
        case 'd':
            marshaller.check = function (data: number) {
                if (typeof data !== 'number') {
                    throw new Error(`Data: ${data} was not of type number`)
                } else if (Number.isNaN(data)) {
                    throw new Error(`Data: ${data} was not a number`)
                } else if (!Number.isFinite(data)) {
                    throw new Error('Number outside range')
                }
            }
            marshaller.marshall = function (ps: Put, data: number) {
                this.check(data)
                align(ps, 8)
                const buff = Buffer.alloc(8)
                buff.writeDoubleLE(parseFloat(data.toString()), 0)
                ps.put(buff)
                ps._offset += 8
            }
            break
        default:
            throw new Error(`Unknown data type format: ${signature}`)
    }
    return marshaller
}

let checkRange = function (minValue: number, maxValue: number, data: number) {
    if (data > maxValue || data < minValue) {
        throw new Error('Number outside range')
    }
}

let checkInteger = function (data: any) {
    if (typeof data !== 'number') {
        throw new Error(`Data: ${data} was not of type number`)
    }
    if (Math.floor(data) !== data) {
        throw new Error(`Data: ${data} was not an integer`)
    }
}

let checkBoolean = function (data: any) {
    if (!(typeof data === 'boolean' || data === 0 || data === 1)) {
        throw new Error(`Data: ${data} was not of type boolean`)
    }
}

let makeLong = function (val: any, signed: boolean) {
    if (val instanceof Long) return val
    if (val instanceof Number) val = val.valueOf()
    if (typeof val === 'number') {
        try {
            checkInteger(val)
            if (signed) {
                checkRange(-0x1fffffffffffff, 0x1fffffffffffff, val)
            } else {
                checkRange(0, 0x1fffffffffffff, val)
            }
        } catch (e: any) {
            e.message += ' (Number type can only carry 53 bit integer)'
            throw e
        }
        try {
            return Long.fromNumber(val, !signed)
        } catch (e: any) {
            e.message = `Error converting number to 64bit integer "${e.message}"`
            throw e
        }
    }
    if (typeof val === 'string' || val instanceof String) {
        let radix = 10
        val = val.trim().toUpperCase()
        if (val.substring(0, 2) === '0X') {
            radix = 16
            val = val.substring(2)
        } else if (val.substring(0, 3) === '-0X') {
            radix = 16
            val = `-${val.substring(3)}`
        }
        val = val.replace(/^0+(?=\d)/, '')
        let data
        try {
            data = Long.fromString(val, !signed, radix)
        } catch (e: any) {
            e.message = `Error converting string to 64bit integer '${e.message}'`
            throw e
        }
        if (data.toString(radix).toUpperCase() !== val) {
            throw new Error(
                `Data: '${val}' did not convert correctly to ${
                    signed ? 'signed' : 'unsigned'
                } 64 bit`
            )
        }
        return data
    }
    try {
        return Long.fromBits(val.low, val.high, val.unsigned)
    } catch (e: any) {
        e.message = `Error converting object to 64bit integer '${e.message}'`
        throw e
    }
}

let checkLong = function (data: any, signed: boolean) {
    if (!Long.isLong(data)) {
        data = makeLong(data, signed)
    }
    if (signed) {
        if (data.unsigned) {
            throw new Error(
                'Longjs object is unsigned, but marshalling into signed 64 bit field'
            )
        }
        if (data.gt(Long.MAX_VALUE) || data.lt(Long.MIN_VALUE)) {
            throw new Error(`Data: ${data} was out of range (64-bit signed)`)
        }
    } else {
        if (!data.unsigned) {
            throw new Error(
                'Longjs object is signed, but marshalling into unsigned 64 bit field'
            )
        }
        if (data.gt(Long.MAX_UNSIGNED_VALUE) || data.lt(0)) {
            throw new Error(`Data: ${data} was out of range (64-bit unsigned)`)
        }
    }
    return data
}
