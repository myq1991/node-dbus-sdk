import {default as Long} from '@homebridge/long'
import {DataType} from '../types/DataType'
import {SignatureError} from './Errors'
import {Signature} from './Signature'

export class DBusBuffer {

    readonly #buffer: Buffer

    readonly #startPos: number = 0

    #position: number = 0

    constructor(buffer?: Buffer, startPos?: number) {
        this.#buffer = buffer ? buffer : Buffer.from([])
        this.#startPos = startPos ? startPos : 0
    }

    public align(power: number): void {
        const allBits: number = (1 << power) - 1
        const paddedOffset: number = ((this.#position + this.#startPos + allBits) >> power) << power
        this.#position = paddedOffset - this.#startPos
    }

    public readInt8(): number {
        this.#position++
        return this.#buffer[this.#position - 1]
    }

    public readSInt16(): number {
        this.align(1)
        const res: number = this.#buffer.readInt16LE(this.#position)
        this.#position += 2
        return res
    }

    public readInt16(): number {
        this.align(1)
        const res: number = this.#buffer.readUInt16LE(this.#position)
        this.#position += 2
        return res
    }

    public readSInt32(): number {
        this.align(2)
        const res: number = this.#buffer.readInt32LE(this.#position)
        this.#position += 4
        return res
    }

    public readInt32(): number {
        this.align(2)
        const res: number = this.#buffer.readUInt32LE(this.#position)
        this.#position += 4
        return res
    }

    public readSInt64(): bigint {
        this.align(3)
        return BigInt(Long.fromBits(this.readInt32(), this.readInt32(), false).toString())
    }

    public readInt64(): bigint {
        this.align(3)
        return BigInt(Long.fromBits(this.readInt32(), this.readInt32(), true).toString())
    }

    public readDouble(): number {
        this.align(3)
        const res: number = this.#buffer.readDoubleLE(this.#position)
        this.#position += 8
        return res
    }

    public readString(len: number): string {
        if (len === 0) {
            this.#position++
            return ''
        }
        const res = this.#buffer.toString('utf8', this.#position, this.#position + len)
        this.#position += len + 1 // dbus strings are always zero-terminated ('s' and 'g' types)
        return res
    }

    public readTree(tree: Record<string, any>): any {
        switch (tree.type) {
            case '(':
            case '{':
            case 'r':
                this.align(3)
                return this.readStruct(tree.child)
            case 'a':
                if (!tree.child || tree.child.length !== 1)
                    throw new SignatureError('Incorrect array element signature')
                let arrayBlobLength = this.readInt32()
                return this.readArray(tree.child[0], arrayBlobLength)
            case 'v':
                return this.readVariant()
            default:
                return this.readSimpleType(tree.type)
        }
    }

    public read(signature: string): any[] {
        const tree: DataType[] = Signature.parseSignature(signature)
        return this.readStruct(tree)
    }

    public readVariant(): any {
        const signature = this.readSimpleType('g')
        const tree: DataType[] = Signature.parseSignature(signature)
        if (tree.length == 1) {
            return this.readTree(tree[0])
        }
        return this.readStruct(tree)
    }

    public readStruct(struct: Record<string, any>): any[] {
        const result: any[] = []
        for (let i: number = 0; i < struct.length; ++i) {
            result.push(this.readTree(struct[i]))
        }
        return result
    }

    public readArray(eleType: DataType, arrayBlobSize: number): any {
        let result: any
        const start: number = this.#position

        // special case: treat ay as Buffer
        if (eleType.type === 'y') {
            this.#position += arrayBlobSize
            return this.#buffer.subarray(start, this.#position)
        }

        // end of array is start of first element + array size
        // we need to add 4 bytes if not on 8-byte boundary
        // and array element needs 8 byte alignment
        if (['x', 't', 'd', '{', '(', 'r'].indexOf(eleType.type) !== -1) this.align(3)
        const end: number = this.#position + arrayBlobSize
        result = []
        let obj = false
        if (eleType.type === '{') {
            result = {}
            obj = true
        }
        while (this.#position < end) {
            if (!obj) {
                result.push(this.readTree(eleType))
                continue
            }
            let res = this.readTree(eleType)
            result[res[0]] = res[1]
        }
        return result
    }

    public readSimpleType(t: string): any {
        switch (t) {
            case 'y':
                return this.readInt8()
            case 'b':
                return !!this.readInt32()
            case 'n':
                return this.readSInt16()
            case 'q':
                return this.readInt16()
            case 'u':
                return this.readInt32()
            case 'i':
                return this.readSInt32()
            case 'g':
                return this.readString(this.readInt8())
            case 's':
            case 'o':
                return this.readString(this.readInt32())
            case 'x':
                return this.readSInt64()
            case 't':
                return this.readInt64()
            case 'd':
                return this.readDouble()
            default:
                throw new SignatureError(`Unsupported type: ${t}`)
        }
    }
}