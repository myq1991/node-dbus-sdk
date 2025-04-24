import {default as Long} from '@homebridge/long'
import {IDBusBufferOptions} from '../types/IDBusBufferOptions'
import {Signature} from './Signature'
import {IType} from '../types/IType'

export class DBusBuffer {

    readonly #buffer: Buffer

    readonly #options: IDBusBufferOptions

    readonly #startPos: number = 0

    #pos: number = 0

    constructor(buffer: Buffer, startPos: number = 0, options?: IDBusBufferOptions) {
        this.#buffer = buffer
        this.#startPos = startPos
        this.#options = {
            ayBuffer: true,
            ReturnLongjs: false,
            simple: true,
            ...options
        }
    }

    public align(power: number): void {
        const allBits: number = (1 << power) - 1
        const paddedOffset: number = ((this.#pos + this.#startPos + allBits) >> power) << power
        this.#pos = paddedOffset - this.#startPos
    }

    public readInt8(): number {
        this.#pos++
        return this.#buffer[this.#pos - 1]
    }

    public readSInt16(): number {
        this.align(1)
        const res: number = this.#buffer.readInt16LE(this.#pos)
        this.#pos += 2
        return res
    }

    public readInt16(): number {
        this.align(1)
        const res: number = this.#buffer.readUInt16LE(this.#pos)
        this.#pos += 2
        return res
    }

    public readSInt32(): number {
        this.align(2)
        const res: number = this.#buffer.readInt32LE(this.#pos)
        this.#pos += 4
        return res
    }

    public readInt32(): number {
        this.align(2)
        const res: number = this.#buffer.readUInt32LE(this.#pos)
        this.#pos += 4
        return res
    }

    public readDouble(): number {
        this.align(3)
        const res: number = this.#buffer.readDoubleLE(this.#pos)
        this.#pos += 8
        return res
    }

    public readString(len: number): string {
        if (len === 0) {
            this.#pos++
            return ''
        }
        const res = this.#buffer.toString('utf8', this.#pos, this.#pos + len)
        this.#pos += len + 1 // dbus strings are always zero-terminated ('s' and 'g' types)
        return res
    }

    public readTree(tree: Record<string, any>) {
        switch (tree.type) {
            case '(':
            case '{':
            case 'r':
                this.align(3)
                return this.readStruct(tree.child)
            case 'a':
                if (!tree.child || tree.child.length !== 1)
                    throw new Error('Incorrect array element signature')
                let arrayBlobLength = this.readInt32()
                return this.readArray(tree.child[0], arrayBlobLength)
            case 'v':
                return this.readVariant()
            default:
                return this.readSimpleType(tree.type)
        }
    }

    public read(signature: string) {
        const tree: IType[] = Signature.parseSignature(signature)
        return this.readStruct(tree)
    }

    public readVariant() {
        const signature = this.readSimpleType('g')
        const tree: IType[] = Signature.parseSignature(signature)
        if (this.#options.simple) {
            if (tree.length == 1) {
                return this.readTree(tree[0])
            }
            return this.readStruct(tree)
        }
        return [tree, this.readStruct(tree)]
    }

    public readStruct(struct) {
        const result: any[] = []
        for (let i: number = 0; i < struct.length; ++i) {
            result.push(this.readTree(struct[i]))
        }
        return result
    }

    public readArray(eleType, arrayBlobSize: number) {
        let result
        const start: number = this.#pos

        // special case: treat ay as Buffer
        if (eleType.type === 'y' && this.#options.ayBuffer) {
            this.#pos += arrayBlobSize
            return this.#buffer.subarray(start, this.#pos)
        }

        // end of array is start of first element + array size
        // we need to add 4 bytes if not on 8-byte boundary
        // and array element needs 8 byte alignment
        if (['x', 't', 'd', '{', '(', 'r'].indexOf(eleType.type) !== -1)
            this.align(3)
        const end: number = this.#pos + arrayBlobSize
        result = []
        let obj = false
        if (this.#options.simple && eleType.type === '{') {
            result = {}
            obj = true
        }
        while (this.#pos < end) {
            if (!obj) {
                result.push(this.readTree(eleType))
                continue
            }
            let res = this.readTree(eleType)
            result[res[0]] = res[1]
        }
        return result
    }

    public readSimpleType(t) {
        let data, len, word0, word1
        switch (t) {
            case 'y':
                return this.readInt8()
            case 'b':
                // TODO: spec says that true is strictly 1 and false is strictly 0
                // should we error (or warn?) when non 01 values?
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
                len = this.readInt8()
                return this.readString(len)
            case 's':
            case 'o':
                len = this.readInt32()
                return this.readString(len)
            // TODO: validate object path here
            //if (t === 'o' && !isValidObjectPath(str))
            //  throw new Error('string is not a valid object path'));
            case 'x':
                //signed
                this.align(3)
                word0 = this.readInt32()
                word1 = this.readInt32()
                data = Long.fromBits(word0, word1, false)
                if (this.#options.ReturnLongjs) return data
                return data.toNumber() // convert to number (good up to 53 bits)
            case 't':
                //unsigned
                this.align(3)
                word0 = this.readInt32()
                word1 = this.readInt32()
                data = Long.fromBits(word0, word1, true)
                if (this.#options.ReturnLongjs) return data
                return data.toNumber() // convert to number (good up to 53 bits)
            case 'd':
                return this.readDouble()
            default:
                throw new Error(`Unsupported type: ${t}`)
        }
    }
}