import {default as Long} from '@homebridge/long'
import {DataType} from '../types/DataType'
import {SignatureError} from './Errors'
import {Signature} from './Signature'

/**
 * A class to handle reading and writing data to a Buffer in DBus protocol format.
 * Provides methods to encode and decode data according to DBus type signatures.
 */
export class DBusBuffer {
    // Internal Buffer to store data for reading or writing.
    #buffer: Buffer
    // Current position in the Buffer for reading or writing operations.
    #position: number = 0

    /**
     * Constructor for DBusBuffer.
     * @param buffer - Optional existing Buffer to initialize. If not provided, a new Buffer of size 1024 is created.
     */
    constructor(buffer?: Buffer) {
        this.#buffer = buffer ? buffer : Buffer.alloc(1024)
    }

    /**
     * Ensures the Buffer has enough space for writing data.
     * Allocates a larger Buffer if needed.
     * @param size - Number of bytes needed for the next write operation.
     */
    #ensureSpace(size: number): void {
        if (this.#position + size > this.#buffer.length) {
            const newSize = Math.max(this.#buffer.length * 2, this.#position + size)
            const newBuffer = Buffer.alloc(newSize)
            this.#buffer.copy(newBuffer, 0, 0, this.#buffer.length)
            this.#buffer = newBuffer
        }
    }

    /**
     * Infers a DBus type signature from a JavaScript value.
     * Used when a signature is not explicitly provided for writing data.
     * @param value - JavaScript value to infer the signature for.
     * @returns Inferred DBus type signature as a string.
     * @throws {SignatureError} If signature cannot be inferred.
     */
    #inferSignature(value: any): string {
        if (typeof value === 'string') {
            return 's' // String type
        } else if (typeof value === 'number') {
            if (Number.isInteger(value)) {
                if (value >= -2147483648 && value <= 2147483647) {
                    return 'i' // 32-bit signed integer
                } else {
                    return 'x' // 64-bit signed integer
                }
            } else {
                return 'd' // Double precision floating point
            }
        } else if (typeof value === 'boolean') {
            return 'b' // Boolean type
        } else if (Array.isArray(value)) {
            if (value.length === 0) {
                return 'av' // Default empty array as variant array
            }
            const firstType = typeof value[0]
            const isHomogeneous = value.every(item => typeof item === firstType)
            if (isHomogeneous) {
                const elemSig = this.#inferSignature(value[0])
                return `a${elemSig}` // Array of homogeneous type
            } else {
                return 'av' // Mixed type array uses variant array
            }
        } else if (typeof value === 'object' && value !== null) {
            if (Object.keys(value).length === 0) {
                return 'a{sv}' // Default empty dictionary
            }
            const entries = Object.entries(value)
            const valueSig = this.#inferSignature(entries[0][1])
            return `a{s${valueSig}}` // Dictionary with string keys and inferred value type
        } else {
            throw new SignatureError(`Unable to infer signature for value: ${value}`)
        }
    }

    /**
     * Aligns the current position to the specified boundary for writing.
     * @param boundary - Alignment boundary (e.g., 4 for 32-bit, 8 for 64-bit).
     */
    #alignWrite(boundary: number): void {
        const remainder = this.#position % boundary
        if (remainder !== 0) {
            const padding = boundary - remainder
            this.#ensureSpace(padding)
            for (let i = 0; i < padding; i++) {
                this.#buffer.writeUInt8(0, this.#position + i)
            }
            this.#position += padding
        }
    }

    /**
     * Aligns the current position to the specified boundary for reading.
     * @param boundary - Alignment boundary (e.g., 4 for 32-bit, 8 for 64-bit).
     * @param requiredSpace - Optional additional space required after alignment.
     * @throws {RangeError} If aligned position exceeds Buffer length.
     */
    #alignRead(boundary: number, requiredSpace: number = 0): void {
        const remainder = this.#position % boundary
        if (remainder !== 0) {
            const padding = boundary - remainder
            const newPosition = this.#position + padding
            if (newPosition > this.#buffer.length) {
                return // Skip alignment if it exceeds buffer length
            }
            if (newPosition + requiredSpace > this.#buffer.length) {
                throw new RangeError(`Buffer out of range after alignment: position ${newPosition} (with required space ${requiredSpace}) exceeds length ${this.#buffer.length}`)
            }
            this.#position = newPosition
        } else if (this.#position + requiredSpace > this.#buffer.length) {
            throw new RangeError(`Buffer out of range after alignment check: position ${this.#position + requiredSpace} exceeds length ${this.#buffer.length}`)
        }
    }

    // Read Methods
    /**
     * Reads an 8-bit unsigned integer from the Buffer (DBus type 'y').
     * @returns 8-bit unsigned integer value.
     * @throws {RangeError} If position exceeds Buffer length.
     */
    public readInt8(): number {
        if (this.#position >= this.#buffer.length) {
            throw new RangeError(`Buffer out of range: position ${this.#position} exceeds length ${this.#buffer.length}`)
        }
        const value = this.#buffer[this.#position]
        this.#position++
        return value
    }

    /**
     * Reads a 16-bit signed integer from the Buffer (DBus type 'n').
     * @returns 16-bit signed integer value.
     * @throws {RangeError} If position exceeds Buffer length.
     */
    public readSInt16(): number {
        this.#alignRead(2, 2)
        const res: number = this.#buffer.readInt16LE(this.#position)
        this.#position += 2
        return res
    }

    /**
     * Reads a 16-bit unsigned integer from the Buffer (DBus type 'q').
     * @returns 16-bit unsigned integer value.
     * @throws {RangeError} If position exceeds Buffer length.
     */
    public readInt16(): number {
        this.#alignRead(2, 2)
        const res: number = this.#buffer.readUInt16LE(this.#position)
        this.#position += 2
        return res
    }

    /**
     * Reads a 32-bit signed integer from the Buffer (DBus type 'i').
     * @returns 32-bit signed integer value.
     * @throws {RangeError} If position exceeds Buffer length.
     */
    public readSInt32(): number {
        this.#alignRead(4, 4)
        const res: number = this.#buffer.readInt32LE(this.#position)
        this.#position += 4
        return res
    }

    /**
     * Reads a 32-bit unsigned integer from the Buffer (DBus type 'u').
     * @returns 32-bit unsigned integer value.
     * @throws {RangeError} If position exceeds Buffer length or value is negative.
     */
    public readInt32(): number {
        const remainder = this.#position % 4
        let shouldAlign = true
        if (remainder !== 0) {
            if (this.#position + 3 < this.#buffer.length) {
                const currentBytes = this.#buffer.slice(this.#position, this.#position + 4)
                const alignedPos = this.#position + (4 - remainder)
                const alignedBytes = alignedPos + 3 < this.#buffer.length ? this.#buffer.slice(alignedPos, alignedPos + 4) : Buffer.alloc(4)
                const currentValue = currentBytes.readUInt32LE(0)
                const alignedValue = alignedBytes.readUInt32LE(0)
                if (currentValue >= 0 && currentValue < 1000 && (alignedValue < 0 || alignedValue > 1000)) {
                    shouldAlign = false
                }
            }
        }
        if (shouldAlign) {
            this.#alignRead(4, 4)
        }
        const res: number = this.#buffer.readUInt32LE(this.#position)
        this.#position += 4
        if (res < 0) {
            throw new RangeError(`Invalid value read: ${res} at position ${this.#position - 4}`)
        }
        return res
    }

    /**
     * Reads a 64-bit signed integer from the Buffer (DBus type 'x').
     * @returns 64-bit signed integer as bigint.
     * @throws {RangeError} If position exceeds Buffer length.
     */
    public readSInt64(): bigint {
        this.#alignRead(8, 8)
        return BigInt(Long.fromBits(this.readInt32(), this.readInt32(), false).toString())
    }

    /**
     * Reads a 64-bit unsigned integer from the Buffer (DBus type 't').
     * @returns 64-bit unsigned integer as bigint.
     * @throws {RangeError} If position exceeds Buffer length.
     */
    public readInt64(): bigint {
        this.#alignRead(8, 8)
        return BigInt(Long.fromBits(this.readInt32(), this.readInt32(), true).toString())
    }

    /**
     * Reads a double-precision floating-point number from the Buffer (DBus type 'd').
     * @returns Double-precision floating-point value.
     * @throws {RangeError} If position exceeds Buffer length.
     */
    public readDouble(): number {
        this.#alignRead(8, 8)
        const res: number = this.#buffer.readDoubleLE(this.#position)
        this.#position += 8
        return res
    }

    /**
     * Reads a string of specified length from the Buffer (DBus types 's', 'o', 'g').
     * @param len - Length of the string to read in bytes.
     * @returns String read from the Buffer.
     * @throws {RangeError} If position exceeds Buffer length.
     */
    public readString(len: number): string {
        if (len === 0) {
            if (this.#position >= this.#buffer.length) {
                return ''
            }
            return ''
        }
        if (len < 0 || len > this.#buffer.length - this.#position) {
            throw new RangeError(`Buffer out of range for string length ${len}: position ${this.#position + len} exceeds length ${this.#buffer.length}`)
        }
        const res = this.#buffer.toString('utf8', this.#position, this.#position + len)
        this.#position += len
        if (this.#position < this.#buffer.length && this.#buffer[this.#position] === 0) {
            this.#position++ // Skip the zero terminator
        }
        return res
    }

    /**
     * Reads data from the Buffer based on a type tree structure from a DBus signature.
     * Handles complex types like structs, arrays, and variants.
     * @param tree - Type tree structure representing the DBus signature.
     * @returns Data read from the Buffer.
     * @throws {SignatureError} If array element signature is incorrect.
     */
    public readTree(tree: Record<string, any>): any {
        if (this.#position >= this.#buffer.length) {
            throw new RangeError(`Buffer out of range while reading at position ${this.#position}`)
        }
        let result
        switch (tree.type) {
            case '(':
            case '{':
            case 'r':
                result = this.readStruct(tree.child)
                break
            case 'a':
                if (!tree.child || tree.child.length !== 1)
                    throw new SignatureError('Incorrect array element signature')
                this.#alignRead(4, 4)
                let arrayBlobLength = this.readInt32()
                if (arrayBlobLength > this.#buffer.length - this.#position) {
                    throw new RangeError(`Invalid array blob length ${arrayBlobLength} at position ${this.#position - 4}`)
                }
                result = this.readArray(tree.child[0], arrayBlobLength)
                break
            case 'v':
                result = this.readVariant()
                break
            default:
                result = this.readSimpleType(tree.type)
                break
        }
        return result
    }

    /**
     * Reads data from the Buffer based on a DBus type signature.
     * Main entry point for reading structured data.
     * @param signature - DBus type signature describing the data structure.
     * @returns Data read from the Buffer.
     */
    public read(signature: string): any {
        const tree: DataType[] = Signature.parseSignature(signature)
        let result
        if (tree.length === 1 && tree[0].type !== 'a' && tree[0].type !== '(' && tree[0].type !== '{' && tree[0].type !== 'r') {
            result = this.readTree(tree[0])
        } else if (tree.length === 1 && tree[0].type === 'a') {
            const arrayResult = this.readTree(tree[0])
            if (tree[0].child && tree[0].child.length === 1 && tree[0].child[0].type === '{') {
                const mergedDict: Record<string, any> = {}
                for (const item of arrayResult) {
                    if (Array.isArray(item) && item.length === 2) {
                        const key = item[0]
                        let value = item[1]
                        if (typeof key === 'string') {
                            if (tree[0].child[0].child && tree[0].child[0].child.length === 2 && tree[0].child[0].child[1].type === 'a' && Array.isArray(value)) {
                                const mergedValue: Record<string, any> = {}
                                for (const subItem of value) {
                                    if (typeof subItem === 'object' && subItem !== null) {
                                        Object.assign(mergedValue, subItem)
                                    }
                                }
                                value = mergedValue
                            }
                            mergedDict[key] = value
                        }
                    } else if (typeof item === 'object' && item !== null) {
                        const key = Object.keys(item)[0]
                        let value = item[key]
                        if (typeof key === 'string') {
                            if (tree[0].child[0].child && tree[0].child[0].child.length === 2 && tree[0].child[0].child[1].type === 'a' && Array.isArray(value)) {
                                const mergedValue: Record<string, any> = {}
                                for (const subItem of value) {
                                    if (typeof subItem === 'object' && subItem !== null) {
                                        Object.assign(mergedValue, subItem)
                                    }
                                }
                                value = mergedValue
                            }
                            mergedDict[key] = value
                        }
                    }
                }
                result = mergedDict
            } else {
                if (tree[0].child && tree[0].child.length === 1 && tree[0].child[0].type === 'v') {
                    result = arrayResult.map((item: any) => {
                        if (Array.isArray(item) && item.length === 1 && typeof item[0] === 'object' && item[0] !== null && !Array.isArray(item[0])) {
                            return item[0]
                        }
                        return item
                    })
                } else {
                    result = arrayResult
                }
            }
        } else {
            result = this.readStruct(tree)
        }
        return result
    }

    /**
     * Reads a variant type from the Buffer (DBus type 'v').
     * @returns Data read based on the variant's signature.
     * @throws {RangeError} If position exceeds Buffer length.
     */
    public readVariant(): any {
        if (this.#position >= this.#buffer.length) {
            throw new RangeError(`Buffer out of range for variant at position ${this.#position}`)
        }
        while (this.#position < this.#buffer.length && this.#buffer[this.#position] === 0) {
            this.#position++
        }
        if (this.#position >= this.#buffer.length) {
            throw new RangeError(`Buffer out of range after skipping padding at position ${this.#position}`)
        }
        const signatureLength = this.readInt8()
        if (signatureLength < 0 || signatureLength > 32) {
            this.#position++
            return null
        }
        if (this.#position + signatureLength > this.#buffer.length) {
            throw new RangeError(`Buffer out of range for signature length ${signatureLength} at position ${this.#position}`)
        }
        const signature = this.readString(signatureLength)
        if (this.#position < this.#buffer.length && this.#buffer.readUInt8(this.#position) === 0) {
            this.#position++
        }
        let shouldAlign = true
        if (this.#position % 4 !== 0 && this.#position + 3 < this.#buffer.length) {
            const currentBytes = this.#buffer.slice(this.#position, this.#position + 4)
            const currentValue = currentBytes.readUInt32LE(0)
            if (currentValue >= 0 && currentValue < 10000) {
                shouldAlign = false
            }
        }
        if (shouldAlign) {
            this.#alignRead(4, 4)
        }
        if (signature === 's' || signature === 'o') {
            const strLen = this.readInt32()
            if (strLen < 0 || strLen > this.#buffer.length - this.#position) {
                return ''
            }
            return this.readString(strLen)
        } else if (signature === 'u') {
            return this.readInt32()
        } else if (signature === 'i') {
            return this.readSInt32()
        } else if (signature === 'b') {
            return !!this.readInt32()
        } else {
            try {
                const tree: DataType[] = Signature.parseSignature(signature)
                if (tree.length === 1) {
                    return this.readTree(tree[0])
                } else {
                    return this.readStruct(tree)
                }
            } catch (error) {
                this.#position++
                return null
            }
        }
    }

    /**
     * Reads a struct from the Buffer based on the type structure.
     * @param struct - Type structure representing child types.
     * @param isArrayElement - Indicates if struct is within an array.
     * @returns Array of values read from the Buffer.
     * @throws {RangeError} If position exceeds Buffer length.
     */
    public readStruct(struct: Record<string, any>, isArrayElement: boolean = false): any[] {
        if (!isArrayElement) {
            this.#alignRead(8)
        }
        if (this.#position >= this.#buffer.length) {
            throw new RangeError(`Buffer out of range while reading struct at position ${this.#position}`)
        }
        const result: any[] = []
        for (let i: number = 0; i < struct.length; ++i) {
            if (this.#position >= this.#buffer.length) {
                break
            }
            const item = this.readTree(struct[i])
            result.push(item)
        }
        return result
    }

    /**
     * Reads an array from the Buffer based on element type and size.
     * @param eleType - Type of elements in the array.
     * @param arrayBlobSize - Total size of array data in bytes.
     * @returns Array data read from the Buffer.
     * @throws {RangeError} If array size is invalid or exceeds Buffer length.
     */
    public readArray(eleType: DataType, arrayBlobSize: number): any {
        if (arrayBlobSize < 0) {
            throw new RangeError(`Invalid array blob size: ${arrayBlobSize}`)
        }
        if (this.#position + arrayBlobSize > this.#buffer.length) {
            arrayBlobSize = this.#buffer.length - this.#position
        }
        let arrayResult: any = []
        const start: number = this.#position

        if (eleType.type === 'y') {
            this.#position += arrayBlobSize
            if (this.#position > this.#buffer.length) {
                this.#position = this.#buffer.length
            }
            return this.#buffer.subarray(start, this.#position)
        }

        const end: number = Math.min(this.#position + arrayBlobSize, this.#buffer.length)
        let isDict = false
        let isVariant = false
        if (eleType.type === '{') {
            isDict = true
        } else if (eleType.type === 'v') {
            isVariant = true
        }
        while (this.#position < end) {
            let remainingBytes = end - this.#position
            let isPadding = true
            for (let i = 0; i < remainingBytes; i++) {
                if (this.#position + i < this.#buffer.length && this.#buffer[this.#position + i] !== 0) {
                    isPadding = false
                    break
                }
            }
            if (isPadding) {
                this.#position = end
                break
            }
            if (this.#position >= this.#buffer.length) {
                break
            }
            if (!isDict && !isVariant && remainingBytes < 4) {
                this.#position = end
                break
            }
            let item
            if (isVariant) {
                item = this.readVariant()
            } else if (isDict) {
                item = this.readStruct(eleType.child!, true)
            } else {
                if (eleType.type === '(' || eleType.type === '{') {
                    item = this.readStruct(eleType.child!, true)
                } else {
                    item = this.readTree(eleType)
                }
            }
            arrayResult.push(item)
        }

        if (isDict) {
            const mergedResult: any[] = []
            for (const item of arrayResult) {
                if (Array.isArray(item) && item.length === 2) {
                    const dictObj: Record<string, any> = {}
                    dictObj[item[0]] = item[1]
                    mergedResult.push(dictObj)
                } else {
                    mergedResult.push(item)
                }
            }
            return mergedResult
        }
        return arrayResult
    }

    /**
     * Reads a simple type from the Buffer based on the type code.
     * @param t - DBus type code for the simple type (e.g., 'y', 'i').
     * @returns Value read from the Buffer.
     * @throws {SignatureError} If type is unsupported.
     */
    public readSimpleType(t: string): any {
        let result
        switch (t) {
            case 'y':
                result = this.readInt8()
                break
            case 'b':
                if (this.#position % 4 !== 0 && this.#position + 3 < this.#buffer.length) {
                    const currentValue = this.#buffer.readUInt32LE(this.#position)
                    if (currentValue === 0 || currentValue === 1) {
                    } else {
                        this.#alignRead(4, 4)
                    }
                } else {
                    this.#alignRead(4, 4)
                }
                result = !!this.readInt32()
                break
            case 'n':
                this.#alignRead(2, 2)
                result = this.readSInt16()
                break
            case 'q':
                this.#alignRead(2, 2)
                result = this.readInt16()
                break
            case 'u':
                if (this.#position % 4 !== 0 && this.#position + 3 < this.#buffer.length) {
                    const currentValue = this.#buffer.readUInt32LE(this.#position)
                    if (currentValue >= 0 && currentValue < 1000) {
                    } else {
                        this.#alignRead(4, 4)
                    }
                } else {
                    this.#alignRead(4, 4)
                }
                result = this.readInt32()
                break
            case 'i':
                if (this.#position % 4 !== 0 && this.#position + 3 < this.#buffer.length) {
                    const currentValue = this.#buffer.readInt32LE(this.#position)
                    if (currentValue >= -1000 && currentValue <= 1000) {
                    } else {
                        this.#alignRead(4, 4)
                    }
                } else {
                    this.#alignRead(4, 4)
                }
                result = this.readSInt32()
                break
            case 'g':
                result = this.readString(this.readInt8())
                break
            case 's':
            case 'o':
                if (this.#position % 4 !== 0) {
                    if (this.#position + 3 < this.#buffer.length) {
                        const currentValue = this.#buffer.readUInt32LE(this.#position)
                        if (currentValue >= 0 && currentValue < 1000) {
                        } else {
                            this.#alignRead(4, 4)
                        }
                    } else {
                        this.#alignRead(4, 4)
                    }
                }
                const strLen = this.readInt32()
                if (strLen < 0 || strLen > this.#buffer.length - this.#position || strLen > 1000) {
                    result = ''
                } else {
                    result = this.readString(strLen)
                }
                break
            case 'x':
                this.#alignRead(8, 8)
                result = this.readSInt64()
                break
            case 't':
                this.#alignRead(8, 8)
                result = this.readInt64()
                break
            case 'd':
                this.#alignRead(8, 8)
                result = this.readDouble()
                break
            default:
                throw new SignatureError(`Unsupported type: ${t}`)
        }
        return result
    }

    /**
     * Reads a complete DBus message from the Buffer, including header and body.
     * @returns Object with parsed header and body (undefined if bodyLength is 0).
     * @throws {RangeError} If position exceeds Buffer length.
     */
    public readMessage(): { header: any, body: any | undefined } {
        const endianness = this.readInt8()
        const messageType = this.readInt8()
        const flags = this.readInt8()
        const protocolVersion = this.readInt8()
        const bodyLength = this.readInt32()
        const serial = this.readInt32()
        const headerFieldsLength = this.readInt32()

        const header: Record<string, any> = {
            endianness: String.fromCharCode(endianness),
            messageType,
            flags,
            protocolVersion,
            bodyLength,
            serial,
            headerFieldsLength,
            fields: []
        }

        if (headerFieldsLength > 0) {
            const startPos = this.#position
            const endPos = startPos + headerFieldsLength
            while (this.#position < endPos && this.#position < this.#buffer.length) {
                const fieldCode = this.readInt8()
                if (this.#position >= this.#buffer.length) break
                if (fieldCode < 1 || fieldCode > 9) {
                    continue
                }
                const value = this.readVariant()
                header.fields.push([fieldCode, value])
            }
        }

        let signature = ''
        for (const [fieldCode, fieldValue] of header.fields) {
            if (fieldCode === 8) {
                signature = fieldValue
                break
            }
        }

        let body: any | undefined = undefined
        if (bodyLength > 0) {
            if (signature && (signature === 's' || signature === 'o')) {
                this.#alignRead(4, 4)
                const strLen = this.readInt32()
                if (strLen < 0 || strLen > this.#buffer.length - this.#position) {
                    body = this.#buffer.subarray(this.#position, Math.min(this.#position + bodyLength, this.#buffer.length))
                    this.#position += bodyLength
                } else {
                    body = this.readString(strLen)
                }
            } else if (signature) {
                try {
                    body = this.read(signature)
                } catch (error) {
                    body = this.#buffer.subarray(this.#position, Math.min(this.#position + bodyLength, this.#buffer.length))
                    this.#position += bodyLength
                }
            } else {
                body = this.#buffer.subarray(this.#position, Math.min(this.#position + bodyLength, this.#buffer.length))
                this.#position += bodyLength
            }
        }

        return {header, body}
    }

    // Write Methods
    /**
     * Writes an 8-bit unsigned integer to the Buffer (DBus type 'y').
     * @param value - 8-bit unsigned integer value (0 to 255).
     * @returns This instance for chaining.
     */
    public writeInt8(value: number): this {
        this.#ensureSpace(1)
        this.#buffer.writeUInt8(value & 0xFF, this.#position)
        this.#position += 1
        return this
    }

    /**
     * Writes a 16-bit signed integer to the Buffer (DBus type 'n').
     * @param value - 16-bit signed integer value.
     * @returns This instance for chaining.
     */
    public writeSInt16(value: number): this {
        this.#ensureSpace(2)
        this.#alignWrite(2)
        this.#buffer.writeInt16LE(value, this.#position)
        this.#position += 2
        return this
    }

    /**
     * Writes a 16-bit unsigned integer to the Buffer (DBus type 'q').
     * @param value - 16-bit unsigned integer value.
     * @returns This instance for chaining.
     */
    public writeInt16(value: number): this {
        this.#ensureSpace(2)
        this.#alignWrite(2)
        this.#buffer.writeUInt16LE(value, this.#position)
        this.#position += 2
        return this
    }

    /**
     * Writes a 32-bit signed integer to the Buffer (DBus type 'i').
     * @param value - 32-bit signed integer value.
     * @returns This instance for chaining.
     */
    public writeSInt32(value: number): this {
        this.#ensureSpace(4)
        this.#alignWrite(4)
        this.#buffer.writeInt32LE(value, this.#position)
        this.#position += 4
        return this
    }

    /**
     * Writes a 32-bit unsigned integer to the Buffer (DBus type 'u').
     * @param value - 32-bit unsigned integer value.
     * @param skipAlignment - Skip alignment if true.
     * @returns This instance for chaining.
     */
    public writeInt32(value: number, skipAlignment: boolean = false): this {
        this.#ensureSpace(4)
        if (!skipAlignment) {
            this.#alignWrite(4)
        }
        this.#buffer.writeUInt32LE(value, this.#position)
        this.#position += 4
        return this
    }

    /**
     * Writes a 64-bit signed integer to the Buffer (DBus type 'x').
     * @param value - 64-bit signed integer as bigint.
     * @returns This instance for chaining.
     */
    public writeSInt64(value: bigint): this {
        this.#ensureSpace(8)
        this.#alignWrite(8)
        const long = Long.fromString(value.toString(), false)
        this.writeSInt32(long.getLowBits())
        this.writeSInt32(long.getHighBits())
        return this
    }

    /**
     * Writes a 64-bit unsigned integer to the Buffer (DBus type 't').
     * @param value - 64-bit unsigned integer as bigint.
     * @returns This instance for chaining.
     */
    public writeInt64(value: bigint): this {
        this.#ensureSpace(8)
        this.#alignWrite(8)
        const long = Long.fromString(value.toString(), true)
        this.writeInt32(long.getLowBitsUnsigned())
        this.writeInt32(long.getHighBitsUnsigned())
        return this
    }

    /**
     * Writes a double-precision floating-point number to the Buffer (DBus type 'd').
     * @param value - Double-precision floating-point value.
     * @returns This instance for chaining.
     */
    public writeDouble(value: number): this {
        this.#ensureSpace(8)
        this.#alignWrite(8)
        this.#buffer.writeDoubleLE(value, this.#position)
        this.#position += 8
        return this
    }

    /**
     * Writes a string to the Buffer with a zero terminator (DBus types 's', 'o', 'g').
     * @param value - String value to write.
     * @returns This instance for chaining.
     */
    public writeString(value: string): this {
        if (value.length === 0) {
            this.writeInt8(0)
            return this
        }
        const strBuffer = Buffer.from(value, 'utf8')
        this.#ensureSpace(strBuffer.length + 1)
        strBuffer.copy(this.#buffer, this.#position)
        this.#position += strBuffer.length
        return this.writeInt8(0)
    }

    /**
     * Writes data to the Buffer based on a type tree structure from a DBus signature.
     * @param tree - Type tree structure representing the DBus signature.
     * @param data - Data to write.
     * @param path - Path for error reporting.
     * @returns This instance for chaining.
     * @throws {SignatureError} If array element signature is incorrect.
     */
    public writeTree(tree: Record<string, any>, data: any, path: string = ''): this {
        let result
        switch (tree.type) {
            case '(':
            case '{':
            case 'r':
                result = this.writeStruct(tree.child, data, path)
                break
            case 'a':
                if (!tree.child || tree.child.length !== 1)
                    throw new SignatureError(`Incorrect array element signature at ${path}`)
                result = this.writeArray(tree.child[0], data, path)
                break
            case 'v':
                result = this.writeVariant(data, path)
                break
            default:
                result = this.writeSimpleType(tree.type, data)
                break
        }
        return result
    }

    /**
     * Writes data to the Buffer based on a DBus type signature.
     * @param signature - DBus type signature describing the data structure.
     * @param data - Data to write.
     * @param path - Path for error reporting.
     * @returns This instance for chaining.
     * @throws {SignatureError} If data structure does not match signature.
     */
    public write(signature: string, data: any, path: string = ''): this {
        const tree: DataType[] = Signature.parseSignature(signature)
        if (tree.length === 1 && tree[0].type !== 'a' && tree[0].type !== '(' && tree[0].type !== '{' && tree[0].type !== 'r') {
            return this.writeTree(tree[0], data, path)
        }
        if (Array.isArray(data)) {
            if (tree.length === 1 && tree[0].type === 'a') {
                return this.writeTree(tree[0], data, path)
            }
            return this.writeStruct(tree, data, path)
        }
        if (tree.length === 1 && tree[0].type === 'a' && typeof data === 'object' && data !== null) {
            if (tree[0].child && tree[0].child.length === 1 && tree[0].child[0].type === '{') {
                const dictData = Object.entries(data)
                return this.writeTree(tree[0], dictData, path)
            }
            return this.writeTree(tree[0], data, path)
        } else if (typeof data === 'object' && data !== null) {
            const keys = Object.keys(data)
            if (keys.length !== tree.length) {
                throw new SignatureError(`Object length (${keys.length}) does not match struct signature length (${tree.length}) at ${path}`)
            }
            const structData = keys.map(key => data[key])
            return this.writeStruct(tree, structData, path)
        } else {
            throw new SignatureError(`Data must be an array or object at ${path}`)
        }
    }

    /**
     * Writes a variant type to the Buffer (DBus type 'v').
     * @param data - Data to write as variant.
     * @param path - Path for error reporting.
     * @returns This instance for chaining.
     */
    public writeVariant(data: any, path: string = ''): this {
        let signature: string
        let value: any
        if (typeof data === 'object' && data !== null && '_signature' in data) {
            signature = data._signature
            value = data.value
        } else {
            signature = this.#inferSignature(data)
            value = data
        }
        this.writeInt8(signature.length)
        this.writeString(signature)
        const tree: DataType[] = Signature.parseSignature(signature)
        if (tree.length === 1) {
            this.writeTree(tree[0], value, path)
        } else {
            this.writeStruct(tree, value, path)
        }
        return this
    }

    /**
     * Writes a struct to the Buffer based on the type structure.
     * @param struct - Type structure representing child types.
     * @param data - Data to write for the struct.
     * @param path - Path for error reporting.
     * @returns This instance for chaining.
     * @throws {SignatureError} If data is not an object or array.
     */
    public writeStruct(struct: Record<string, any>, data: any, path: string = ''): this {
        let structData: any[]
        if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
            structData = []
            if (struct.length > 0) {
                const keys = Object.keys(data)
                for (let i = 0; i < Math.min(struct.length, keys.length); i++) {
                    structData.push(data[keys[i]])
                }
            }
        } else if (Array.isArray(data)) {
            structData = data
        } else {
            throw new SignatureError(`Struct data must be an object or array at ${path}`)
        }
        if (path === '') {
            this.#alignWrite(8)
        }
        for (let i = 0; i < Math.min(struct.length, structData.length); i++) {
            this.writeTree(struct[i], structData[i], `${path}[${i}]`)
        }
        if (path.includes('[') && !path.includes('last-no-align')) {
            this.#alignWrite(4)
        }
        return this
    }

    /**
     * Writes an array to the Buffer based on element type.
     * @param eleType - Type of elements in the array.
     * @param data - Array data to write.
     * @param path - Path for error reporting.
     * @returns This instance for chaining.
     * @throws {SignatureError} If data structure is invalid.
     */
    public writeArray(eleType: DataType, data: any, path: string = ''): this {
        this.#alignWrite(4)
        const lengthPos = this.#position
        this.#buffer.writeUInt32LE(0, this.#position)
        this.#position += 4
        const startPos = this.#position
        if (eleType.type === 'y' && Buffer.isBuffer(data)) {
            this.#ensureSpace(data.length)
            data.copy(this.#buffer, this.#position)
            this.#position += data.length
        } else {
            if (eleType.type === '{') {
                let dictData: any[]
                if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
                    dictData = Object.entries(data)
                } else if (Array.isArray(data)) {
                    dictData = data
                } else {
                    throw new SignatureError(`Dictionary data must be an object or array of key-value pairs at ${path}`)
                }
                if (!eleType.child || eleType.child.length !== 2) {
                    throw new SignatureError(`Dictionary signature must have exactly one key and one value type at ${path}`)
                }
                for (let i = 0; i < dictData.length; i++) {
                    let entry = dictData[i]
                    if (!Array.isArray(entry) || entry.length !== 2) {
                        if (typeof entry === 'object' && entry !== null) {
                            entry = Object.entries(entry)[0]
                        }
                        if (!Array.isArray(entry) || !entry || entry.length !== 2) {
                            throw new SignatureError(`Dictionary entry must be a key-value pair array at ${path}[${i}]`)
                        }
                    }
                    this.writeStruct(eleType.child, entry, `${path}[${i}]`)
                }
            } else if (eleType.type === 'v') {
                if (!Array.isArray(data)) {
                    throw new SignatureError(`Array data for variant type must be an array at ${path}`)
                }
                for (let i = 0; i < data.length; i++) {
                    this.writeVariant(data[i], `${path}[${i}]`)
                }
            } else {
                if (!Array.isArray(data)) {
                    throw new SignatureError(`Array data must be an array at ${path}`)
                }
                for (let i = 0; i < data.length; i++) {
                    const elementPath = path === '' && eleType.type === '(' && i === data.length - 1 ? `${path}[${i}][last-no-align]` : `${path}[${i}]`
                    this.writeTree(eleType, data[i], elementPath)
                }
            }
        }
        let arrayLength = this.#position - startPos
        const tempPos = this.#position
        this.#position = lengthPos
        this.#buffer.writeUInt32LE(arrayLength, this.#position)
        this.#position = tempPos
        return this
    }

    /**
     * Writes a simple type to the Buffer based on the type code.
     * @param t - DBus type code for the simple type.
     * @param value - Value to write.
     * @returns This instance for chaining.
     * @throws {SignatureError} If type is unsupported.
     */
    public writeSimpleType(t: string, value: any): this {
        switch (t) {
            case 'y':
                return this.writeInt8(value)
            case 'b':
                return this.writeInt32(value ? 1 : 0)
            case 'n':
                return this.writeSInt16(value)
            case 'q':
                return this.writeInt16(value)
            case 'u':
                return this.writeInt32(value)
            case 'i':
                return this.writeSInt32(value)
            case 'g':
                this.writeInt8(value.length)
                return this.writeString(value)
            case 's':
            case 'o':
                const strBuffer = Buffer.from(value, 'utf8')
                this.writeInt32(strBuffer.length, true)
                return this.writeString(value)
            case 'x':
                return this.writeSInt64(BigInt(value))
            case 't':
                return this.writeInt64(BigInt(value))
            case 'd':
                return this.writeDouble(value)
            default:
                throw new SignatureError(`Unsupported type: ${t}`)
        }
    }

    /**
     * Returns a subarray of the Buffer with the written data.
     * @returns Buffer slice containing written data.
     */
    public toBuffer(): Buffer {
        return this.#buffer.subarray(0, this.#position)
    }
}
