import {default as Long} from '@homebridge/long'
import {DataType} from '../types/DataType'
import {SignatureError} from './Errors'
import {Signature} from './Signature'

/**
 * A class to handle reading and writing data to a Buffer in DBus protocol format.
 * This class provides methods to encode and decode data according to DBus type signatures.
 */
export class DBusBuffer {
    // The internal Buffer to store data for reading or writing.
    #buffer: Buffer
    // The current position in the Buffer for reading or writing operations.
    #position: number = 0

    /**
     * Constructor for DBusBuffer.
     * @param buffer - An optional existing Buffer to initialize the instance. If not provided, a new Buffer of size 1024 is created.
     */
    constructor(buffer?: Buffer) {
        this.#buffer = buffer ? buffer : Buffer.alloc(1024)
    }

    /**
     * Private helper method to ensure the Buffer has enough space for writing data.
     * If the current position plus the required size exceeds the Buffer length, it allocates a larger Buffer.
     * @param size - The number of bytes needed for the next write operation.
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
     * Private helper method to infer a DBus type signature from a JavaScript value.
     * This method is used when a signature is not explicitly provided for writing data.
     * @param value - The JavaScript value to infer the signature for.
     * @returns The inferred DBus type signature as a string.
     * @throws {SignatureError} If the signature cannot be inferred for the given value.
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
            // Check if all elements in the array are of the same type
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
     * Aligns the current position to the specified boundary (e.g., 4-byte or 8-byte alignment) for writing.
     * @param boundary - The alignment boundary (e.g., 4 for 32-bit, 8 for 64-bit).
     */
    #alignWrite(boundary: number): void {
        const remainder = this.#position % boundary
        if (remainder !== 0) {
            const padding = boundary - remainder
            this.#ensureSpace(padding)
            for (let i = 0; i < padding; i++) {
                this.#buffer.writeUInt8(0, this.#position + i) // Write padding bytes as 0
            }
            this.#position += padding
        }
    }

    /**
     * Aligns the current position to the specified boundary (e.g., 4-byte or 8-byte alignment) for reading.
     * @param boundary - The alignment boundary (e.g., 4 for 32-bit, 8 for 64-bit).
     * @param requiredSpace - Optional additional space required after alignment.
     * @throws {RangeError} If the aligned position exceeds the Buffer length or if required space after alignment is not available.
     */
    #alignRead(boundary: number, requiredSpace: number = 0): void {
        const remainder = this.#position % boundary
        if (remainder !== 0) {
            const padding = boundary - remainder
            const newPosition = this.#position + padding
            if (newPosition > this.#buffer.length || newPosition + requiredSpace > this.#buffer.length) {
                throw new RangeError(`Buffer out of range after alignment: position ${newPosition} (with required space ${requiredSpace}) exceeds length ${this.#buffer.length}`)
            }
            this.#position = newPosition
        } else if (this.#position + requiredSpace > this.#buffer.length) {
            throw new RangeError(`Buffer out of range after alignment check: position ${this.#position + requiredSpace} exceeds length ${this.#buffer.length}`)
        }
    }

    // Read Methods
    /**
     * Reads an 8-bit unsigned integer (byte) from the Buffer.
     * Corresponds to DBus type 'y'.
     * @returns The 8-bit unsigned integer value read from the Buffer.
     * @throws {RangeError} If the current position exceeds the Buffer length.
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
     * Reads a 16-bit signed integer from the Buffer in little-endian format.
     * Corresponds to DBus type 'n'.
     * @returns The 16-bit signed integer value read from the Buffer.
     * @throws {RangeError} If the current position plus 2 bytes exceeds the Buffer length.
     */
    public readSInt16(): number {
        this.#alignRead(2, 2) // 16-bit alignment
        const res: number = this.#buffer.readInt16LE(this.#position)
        this.#position += 2
        return res
    }

    /**
     * Reads a 16-bit unsigned integer from the Buffer in little-endian format.
     * Corresponds to DBus type 'q'.
     * @returns The 16-bit unsigned integer value read from the Buffer.
     * @throws {RangeError} If the current position plus 2 bytes exceeds the Buffer length.
     */
    public readInt16(): number {
        this.#alignRead(2, 2) // 16-bit alignment
        const res: number = this.#buffer.readUInt16LE(this.#position)
        this.#position += 2
        return res
    }

    /**
     * Reads a 32-bit signed integer from the Buffer in little-endian format.
     * Corresponds to DBus type 'i'.
     * @returns The 32-bit signed integer value read from the Buffer.
     * @throws {RangeError} If the current position plus 4 bytes exceeds the Buffer length.
     */
    public readSInt32(): number {
        this.#alignRead(4, 4) // 32-bit alignment
        const res: number = this.#buffer.readInt32LE(this.#position)
        this.#position += 4
        return res
    }

    /**
     * Reads a 32-bit unsigned integer from the Buffer in little-endian format.
     * Corresponds to DBus type 'u'.
     * @returns The 32-bit unsigned integer value read from the Buffer.
     * @throws {RangeError} If the current position plus 4 bytes exceeds the Buffer length or if the value is negative.
     */
    public readInt32(): number {
        this.#alignRead(4, 4) // 32-bit alignment
        const res: number = this.#buffer.readUInt32LE(this.#position)
        this.#position += 4
        if (res < 0) {
            throw new RangeError(`Invalid value read: ${res} at position ${this.#position - 4}`)
        }
        return res
    }

    /**
     * Reads a 64-bit signed integer from the Buffer in little-endian format.
     * Corresponds to DBus type 'x'.
     * @returns The 64-bit signed integer value as a bigint read from the Buffer.
     * @throws {RangeError} If the current position plus 8 bytes exceeds the Buffer length.
     */
    public readSInt64(): bigint {
        this.#alignRead(8, 8) // 64-bit alignment
        const result = BigInt(Long.fromBits(this.readInt32(), this.readInt32(), false).toString())
        return result
    }

    /**
     * Reads a 64-bit unsigned integer from the Buffer in little-endian format.
     * Corresponds to DBus type 't'.
     * @returns The 64-bit unsigned integer value as a bigint read from the Buffer.
     * @throws {RangeError} If the current position plus 8 bytes exceeds the Buffer length.
     */
    public readInt64(): bigint {
        this.#alignRead(8, 8) // 64-bit alignment
        const result = BigInt(Long.fromBits(this.readInt32(), this.readInt32(), true).toString())
        return result
    }

    /**
     * Reads a double-precision floating-point number from the Buffer in little-endian format.
     * Corresponds to DBus type 'd'.
     * @returns The double-precision floating-point value read from the Buffer.
     * @throws {RangeError} If the current position plus 8 bytes exceeds the Buffer length.
     */
    public readDouble(): number {
        this.#alignRead(8, 8) // 64-bit alignment
        const res: number = this.#buffer.readDoubleLE(this.#position)
        this.#position += 8
        return res
    }

    /**
     * Reads a string of specified length from the Buffer.
     * Corresponds to DBus types 's', 'o', and 'g'. DBus strings are zero-terminated.
     * @param len - The length of the string to read (in bytes).
     * @returns The string read from the Buffer.
     * @throws {RangeError} If the current position or position plus length exceeds the Buffer length.
     */
    public readString(len: number): string {
        if (len === 0) {
            if (this.#position >= this.#buffer.length) {
                throw new RangeError(`Buffer out of range: position ${this.#position} exceeds length ${this.#buffer.length}`)
            }
            this.#position++
            return ''
        }
        // Ensure alignment for string content if needed, but length prefix should already be aligned
        if (len > this.#buffer.length - this.#position) {
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
     * Reads data from the Buffer based on a type tree structure derived from a DBus signature.
     * Handles complex types like structs, arrays, and variants.
     * @param tree - The type tree structure representing the DBus signature.
     * @returns The data read from the Buffer, structured according to the type tree.
     * @throws {SignatureError} If the array element signature is incorrect.
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
                this.#alignRead(4, 4) // Align before reading array length
                let arrayBlobLength = this.readInt32()
                // Ensure array length does not exceed remaining buffer
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
     * This is the main entry point for reading structured data.
     * @param signature - The DBus type signature describing the data structure to read.
     * @returns The data read from the Buffer, structured according to the signature.
     */
    public read(signature: string): any {
        const tree: DataType[] = Signature.parseSignature(signature)
        let result
        if (tree.length === 1 && tree[0].type !== 'a' && tree[0].type !== '(' && tree[0].type !== '{' && tree[0].type !== 'r') {
            // If the signature is a basic type, return a single value
            result = this.readTree(tree[0])
        } else if (tree.length === 1 && tree[0].type === 'a') {
            // If the signature is a single array type, return the array value
            const arrayResult = this.readTree(tree[0])
            // For dictionary array signatures like a{sv}, merge array result into a single object
            if (tree[0].child && tree[0].child.length === 1 && tree[0].child[0].type === '{') {
                const mergedDict: Record<string, any> = {}
                for (const item of arrayResult) {
                    if (typeof item === 'object' && item !== null) {
                        Object.assign(mergedDict, item)
                    }
                }
                result = mergedDict
            } else {
                result = arrayResult
            }
        } else {
            // Otherwise, return a struct array
            result = this.readStruct(tree)
        }
        return result
    }

    /**
     * Reads a variant type from the Buffer.
     * A variant is a type that includes its own signature, allowing dynamic typing.
     * @returns The data read from the Buffer based on the variant's signature.
     * @throws {RangeError} If the Buffer position exceeds the length during reading.
     */
    public readVariant(): any {
        // Do not align immediately to check for padding bytes manually
        if (this.#position >= this.#buffer.length) {
            throw new RangeError(`Buffer out of range for variant at position ${this.#position}`)
        }
        // Skip potential padding bytes manually if they exist (usually 0)
        while (this.#position < this.#buffer.length && this.#buffer[this.#position] === 0) {
            this.#position++
        }
        if (this.#position >= this.#buffer.length) {
            throw new RangeError(`Buffer out of range after skipping padding at position ${this.#position}`)
        }
        // Now read the signature length (for type 'g')
        const signatureLength = this.readInt8() // Signature length (for 'g')
        if (signatureLength < 0 || signatureLength > 32) { // Arbitrary max length for signature
            return null // Fallback: return null for invalid length
        }
        if (this.#position + signatureLength > this.#buffer.length) {
            throw new RangeError(`Buffer out of range for signature length ${signatureLength} at position ${this.#position}`)
        }
        const signature = this.readString(signatureLength)
        // Handle known signature types manually to avoid parsing errors
        if (signature === 's' || signature === 'o') {
            // For string or object path, read the actual data with aligned length
            this.#alignRead(4, 4) // Align for string length prefix
            const strLen = this.readInt32()
            if (strLen < 0 || strLen > this.#buffer.length - this.#position) {
                return ''
            }
            return this.readString(strLen)
        } else if (signature === 'u') {
            // For unsigned integer, read aligned value
            this.#alignRead(4, 4)
            return this.readInt32()
        } else if (signature === 'i') {
            // For signed integer, read aligned value
            this.#alignRead(4, 4)
            return this.readSInt32()
        } else {
            try {
                const tree: DataType[] = Signature.parseSignature(signature)
                if (tree.length === 1) {
                    return this.readTree(tree[0])
                } else {
                    return this.readStruct(tree)
                }
            } catch (error) {
                // Fallback: return the signature as value if parsing fails
                return signature
            }
        }
    }

    /**
     * Reads a struct (or tuple) from the Buffer based on the provided type structure.
     * @param struct - The type structure representing the struct's child types.
     * @returns An array of values read from the Buffer, corresponding to the struct's child types.
     */
    public readStruct(struct: Record<string, any>): any[] {
        this.#alignRead(8) // Structs often start at 8-byte alignment in DBus
        if (this.#position >= this.#buffer.length) {
            throw new RangeError(`Buffer out of range while reading struct at position ${this.#position}`)
        }
        const result: any[] = []
        for (let i: number = 0; i < struct.length; ++i) {
            if (this.#position >= this.#buffer.length) {
                break // Stop if buffer is exhausted
            }
            result.push(this.readTree(struct[i]))
        }
        return result
    }

    /**
     * Reads an array from the Buffer based on the element type and size.
     * Handles special cases like byte arrays ('ay') and dictionary types ('{...}').
     * @param eleType - The type of elements in the array.
     * @param arrayBlobSize - The total size of the array data in bytes.
     * @returns The array data read from the Buffer, structured according to the element type.
     * @throws {RangeError} If the array size is invalid or exceeds the Buffer length.
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

        // Special case: treat 'ay' (byte array) as Buffer
        if (eleType.type === 'y') {
            this.#position += arrayBlobSize
            if (this.#position > this.#buffer.length) {
                this.#position = this.#buffer.length
            }
            const byteArray = this.#buffer.subarray(start, this.#position)
            return byteArray
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
            if (this.#position >= this.#buffer.length) {
                break // Stop if buffer is exhausted
            }
            let item
            if (isVariant) {
                item = this.readVariant()
            } else {
                item = this.readTree(eleType)
            }
            arrayResult.push(item)
        }

        // If it's a dictionary type, process merging logic into an array of objects
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
     * Reads a simple (basic) type from the Buffer based on the provided type code.
     * @param t - The DBus type code for the simple type to read (e.g., 'y', 'i', 's').
     * @returns The value read from the Buffer, corresponding to the specified type.
     * @throws {SignatureError} If the type is unsupported.
     */
    public readSimpleType(t: string): any {
        let result
        switch (t) {
            case 'y':
                result = this.readInt8() // 8-bit unsigned integer
                break
            case 'b':
                result = !!this.readInt32() // Boolean (stored as 32-bit integer)
                break
            case 'n':
                result = this.readSInt16() // 16-bit signed integer
                break
            case 'q':
                result = this.readInt16() // 16-bit unsigned integer
                break
            case 'u':
                result = this.readInt32() // 32-bit unsigned integer
                break
            case 'i':
                result = this.readSInt32() // 32-bit signed integer
                break
            case 'g':
                result = this.readString(this.readInt8()) // Signature string (8-bit length)
                break
            case 's':
            case 'o':
                result = this.readString(this.readInt32()) // String or object path (32-bit length)
                break
            case 'x':
                result = this.readSInt64() // 64-bit signed integer
                break
            case 't':
                result = this.readInt64() // 64-bit unsigned integer
                break
            case 'd':
                result = this.readDouble() // Double precision floating point
                break
            default:
                throw new SignatureError(`Unsupported type: ${t}`)
        }
        return result
    }

    /**
     * Reads a complete DBus message from the Buffer, including header and body.
     * @returns An object containing the parsed header and body. Body is undefined if bodyLength is 0.
     * @throws {RangeError} If the Buffer position exceeds the length during reading.
     */
    public readMessage(): { header: any, body: any | undefined } {
        const endianness = this.readInt8() // Byte order
        const messageType = this.readInt8() // Message type
        const flags = this.readInt8() // Flags
        const protocolVersion = this.readInt8() // Protocol version
        const bodyLength = this.readInt32() // Body length
        const serial = this.readInt32() // Serial number
        const headerFieldsLength = this.readInt32() // Header fields array length

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

        // Read header fields array manually to handle alignment issues
        if (headerFieldsLength > 0) {
            const startPos = this.#position
            const endPos = startPos + headerFieldsLength
            while (this.#position < endPos && this.#position < this.#buffer.length) {
                // Do not align for field code to read it directly
                const fieldCode = this.readInt8() // Field code (y)
                if (this.#position >= this.#buffer.length) break
                // Check if fieldCode is valid (expected range for DBus header fields is 1-9)
                if (fieldCode < 1 || fieldCode > 9) {
                    continue // Skip invalid field code
                }
                // Read variant manually, padding is handled inside readVariant
                const value = this.readVariant()
                header.fields.push([fieldCode, value])
            }
        }

        // Extract signature from header fields (if present)
        let signature = ''
        for (const [fieldCode, fieldValue] of header.fields) {
            if (fieldCode === 8) { // SIGNATURE field code
                signature = fieldValue
                break
            }
        }

        // Read body based on signature, return undefined if bodyLength is 0
        let body: any | undefined = undefined
        if (bodyLength > 0) {
            if (signature && (signature === 's' || signature === 'o')) {
                this.#alignRead(4, 4) // Align for string length prefix
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
     * Writes an 8-bit unsigned integer (byte) to the Buffer.
     * Corresponds to DBus type 'y'.
     * @param value - The 8-bit unsigned integer value to write (0 to 255).
     * @returns This instance for method chaining.
     */
    public writeInt8(value: number): this {
        this.#ensureSpace(1)
        this.#buffer.writeUInt8(value & 0xFF, this.#position)
        this.#position += 1
        return this
    }

    /**
     * Writes a 16-bit signed integer to the Buffer in little-endian format.
     * Corresponds to DBus type 'n'.
     * @param value - The 16-bit signed integer value to write.
     * @returns This instance for method chaining.
     */
    public writeSInt16(value: number): this {
        this.#ensureSpace(2)
        this.#alignWrite(2) // Align to 2-byte boundary for INT16
        this.#buffer.writeInt16LE(value, this.#position)
        this.#position += 2
        return this
    }

    /**
     * Writes a 16-bit unsigned integer to the Buffer in little-endian format.
     * Corresponds to DBus type 'q'.
     * @param value - The 16-bit unsigned integer value to write.
     * @returns This instance for method chaining.
     */
    public writeInt16(value: number): this {
        this.#ensureSpace(2)
        this.#alignWrite(2) // Align to 2-byte boundary for UINT16
        this.#buffer.writeUInt16LE(value, this.#position)
        this.#position += 2
        return this
    }

    /**
     * Writes a 32-bit signed integer to the Buffer in little-endian format.
     * Corresponds to DBus type 'i'.
     * @param value - The 32-bit signed integer value to write.
     * @returns This instance for method chaining.
     */
    public writeSInt32(value: number): this {
        this.#ensureSpace(4)
        this.#alignWrite(4) // Align to 4-byte boundary for INT32
        this.#buffer.writeInt32LE(value, this.#position)
        this.#position += 4
        return this
    }

    /**
     * Writes a 32-bit unsigned integer to the Buffer in little-endian format.
     * Corresponds to DBus type 'u'.
     * @param value - The 32-bit unsigned integer value to write.
     * @returns This instance for method chaining.
     */
    public writeInt32(value: number, skipAlignment: boolean = false): this {
        this.#ensureSpace(4)
        if (!skipAlignment) {
            this.#alignWrite(4) // Align to 4-byte boundary for UINT32 by default
        }
        this.#buffer.writeUInt32LE(value, this.#position)
        this.#position += 4
        return this
    }

    /**
     * Writes a 64-bit signed integer to the Buffer in little-endian format.
     * Corresponds to DBus type 'x'.
     * @param value - The 64-bit signed integer value to write as a bigint.
     * @returns This instance for method chaining.
     */
    public writeSInt64(value: bigint): this {
        this.#ensureSpace(8)
        this.#alignWrite(8) // Align to 8-byte boundary for INT64
        const long = Long.fromString(value.toString(), false)
        this.writeSInt32(long.getLowBits())
        this.writeSInt32(long.getHighBits())
        return this
    }

    /**
     * Writes a 64-bit unsigned integer to the Buffer in little-endian format.
     * Corresponds to DBus type 't'.
     * @param value - The 64-bit unsigned integer value to write as a bigint.
     * @returns This instance for method chaining.
     */
    public writeInt64(value: bigint): this {
        this.#ensureSpace(8)
        this.#alignWrite(8) // Align to 8-byte boundary for UINT64
        const long = Long.fromString(value.toString(), true)
        this.writeInt32(long.getLowBitsUnsigned())
        this.writeInt32(long.getHighBitsUnsigned())
        return this
    }

    /**
     * Writes a double-precision floating-point number to the Buffer in little-endian format.
     * Corresponds to DBus type 'd'.
     * @param value - The double-precision floating-point value to write.
     * @returns This instance for method chaining.
     */
    public writeDouble(value: number): this {
        this.#ensureSpace(8)
        this.#alignWrite(8) // Align to 8-byte boundary for DOUBLE
        this.#buffer.writeDoubleLE(value, this.#position)
        this.#position += 8
        return this
    }

    /**
     * Writes a string to the Buffer with a zero terminator.
     * Corresponds to DBus types 's', 'o', and 'g'.
     * @param value - The string value to write.
     * @returns This instance for method chaining.
     */
    public writeString(value: string): this {
        if (value.length === 0) {
            this.writeInt8(0) // Write a zero terminator for empty string
            return this
        }
        const strBuffer = Buffer.from(value, 'utf8')
        this.#ensureSpace(strBuffer.length + 1)
        strBuffer.copy(this.#buffer, this.#position)
        this.#position += strBuffer.length
        return this.writeInt8(0) // DBus strings are zero-terminated
    }

    /**
     * Writes data to the Buffer based on a type tree structure derived from a DBus signature.
     * Handles complex types like structs, arrays, and variants.
     * @param tree - The type tree structure representing the DBus signature.
     * @param data - The data to write to the Buffer.
     * @param path - A string path for error reporting (used for debugging nested structures).
     * @returns This instance for method chaining.
     * @throws {SignatureError} If the array element signature is incorrect or data structure is invalid.
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
     * This is the main entry point for writing structured data.
     * @param signature - The DBus type signature describing the data structure to write.
     * @param data - The data to write to the Buffer.
     * @param path - A string path for error reporting (used for debugging nested structures).
     * @returns This instance for method chaining.
     * @throws {SignatureError} If the data structure does not match the signature.
     */
    public write(signature: string, data: any, path: string = ''): this {
        const tree: DataType[] = Signature.parseSignature(signature)
        // If the signature is a basic type, process it directly
        if (tree.length === 1 && tree[0].type !== 'a' && tree[0].type !== '(' && tree[0].type !== '{' && tree[0].type !== 'r') {
            return this.writeTree(tree[0], data, path)
        }
        // If data is an array, pass it directly
        if (Array.isArray(data)) {
            // If it's an array type signature, process the data directly
            if (tree.length === 1 && tree[0].type === 'a') {
                return this.writeTree(tree[0], data, path)
            }
            return this.writeStruct(tree, data, path)
        }
        // If the signature is an array type (e.g., a{sv}) and input is an object, convert to array
        if (tree.length === 1 && tree[0].type === 'a' && typeof data === 'object' && data !== null) {
            if (tree[0].child && tree[0].child.length === 1 && tree[0].child[0].type === '{') {
                // For a{sv} signature, convert object to key-value pair array
                const dictData = Object.entries(data)
                return this.writeTree(tree[0], dictData, path)
            }
            return this.writeTree(tree[0], data, path)
        }
        // If data is an object, attempt to convert it to an array
        else if (typeof data === 'object' && data !== null) {
            const keys = Object.keys(data)
            if (keys.length !== tree.length) {
                throw new SignatureError(`Object length (${keys.length}) does not match struct signature length (${tree.length}) at ${path}`)
            }
            // Assume object field order matches signature order
            const structData = keys.map(key => data[key])
            return this.writeStruct(tree, structData, path)
        } else {
            throw new SignatureError(`Data must be an array or object at ${path}`)
        }
    }

    /**
     * Writes a variant type to the Buffer.
     * A variant includes its own signature, allowing dynamic typing.
     * @param data - The data to write as a variant. If it includes '_signature', uses that; otherwise, infers the signature.
     * @param path - A string path for error reporting (used for debugging nested structures).
     * @returns This instance for method chaining.
     */
    public writeVariant(data: any, path: string = ''): this {
        let signature: string
        let value: any

        if (typeof data === 'object' && data !== null && '_signature' in data) {
            signature = data._signature
            value = data.value
        } else {
            // Automatically infer the type
            signature = this.#inferSignature(data)
            value = data
        }

        // Write signature as a DBus signature string ('g') without extra padding
        this.writeInt8(signature.length)
        this.writeString(signature)

        // Write the value based on the signature without extra padding
        const tree: DataType[] = Signature.parseSignature(signature)
        if (tree.length === 1) {
            this.writeTree(tree[0], value, path)
        } else {
            this.writeStruct(tree, value, path)
        }
        return this
    }

    /**
     * Writes a struct (or tuple) to the Buffer based on the provided type structure.
     * @param struct - The type structure representing the struct's child types.
     * @param data - The data to write for the struct. Can be an object or array.
     * @param path - A string path for error reporting (used for debugging nested structures).
     * @returns This instance for method chaining.
     * @throws {SignatureError} If the struct data is not an object or array.
     */
    public writeStruct(struct: Record<string, any>, data: any, path: string = ''): this {
        // If data is an object rather than an array, attempt to convert based on signature
        let structData: any[]
        if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
            structData = []
            if (struct.length > 0) {
                const keys = Object.keys(data)
                // Relax length validation to avoid errors with nested structures
                for (let i = 0; i < Math.min(struct.length, keys.length); i++) {
                    structData.push(data[keys[i]])
                }
            }
        } else if (Array.isArray(data)) {
            structData = data
        } else {
            throw new SignatureError(`Struct data must be an object or array at ${path}`)
        }

        // Align to 8-byte boundary for struct if it's a top-level message struct (not for header fields)
        if (path === '') {
            this.#alignWrite(8)
        }

        // Relax length validation to avoid errors with nested structures
        for (let i = 0; i < Math.min(struct.length, structData.length); i++) {
            this.writeTree(struct[i], structData[i], `${path}[${i}]`)
        }

        // For header fields (path includes array index), align to 4-byte boundary after each struct
        // But skip alignment if path contains a special flag indicating it's the last field
        if (path.includes('[') && !path.includes('last-no-align')) {
            this.#alignWrite(4)
        }

        return this
    }

    /**
     * Writes an array to the Buffer based on the element type.
     * Handles special cases like byte arrays ('ay') and dictionary types ('{...}').
     * @param eleType - The type of elements in the array.
     * @param data - The array data to write to the Buffer.
     * @param path - A string path for error reporting (used for debugging nested structures).
     * @returns This instance for method chaining.
     * @throws {SignatureError} If the data structure does not match the expected format for the array or dictionary.
     */
    public writeArray(eleType: DataType, data: any, path: string = ''): this {
        // Align before writing array length
        this.#alignWrite(4)

        // Write a placeholder for array length (updated later)
        const lengthPos = this.#position
        this.#buffer.writeUInt32LE(0, this.#position) // Placeholder for array length directly
        this.#position += 4

        // Record the start position of array data
        const startPos = this.#position

        // Special case: 'ay' type writes Buffer directly
        if (eleType.type === 'y' && Buffer.isBuffer(data)) {
            this.#ensureSpace(data.length)
            data.copy(this.#buffer, this.#position)
            this.#position += data.length
        } else {
            if (eleType.type === '{') {
                // Dictionary type, check if data is an object and convert if necessary
                let dictData: any[]
                if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
                    dictData = Object.entries(data)
                } else if (Array.isArray(data)) {
                    dictData = data
                } else {
                    throw new SignatureError(`Dictionary data must be an object or array of key-value pairs at ${path}`)
                }

                // Validate dictionary key and value types
                if (!eleType.child || eleType.child.length !== 2) {
                    throw new SignatureError(`Dictionary signature must have exactly one key and one value type at ${path}`)
                }

                for (let i = 0; i < dictData.length; i++) {
                    let entry = dictData[i]
                    if (!Array.isArray(entry) || entry.length !== 2) {
                        // If not a key-value pair array, attempt to process
                        if (typeof entry === 'object' && entry !== null) {
                            entry = Object.entries(entry)[0] // Assume each entry is an object, take the first key-value pair
                        }
                        if (!Array.isArray(entry) || entry.length !== 2) {
                            throw new SignatureError(`Dictionary entry must be a key-value pair array at ${path}[${i}]`)
                        }
                    }
                    this.writeStruct(eleType.child, entry, `${path}[${i}]`)
                }
            } else if (eleType.type === 'v') {
                // Variant array, handle mixed types
                if (!Array.isArray(data)) {
                    throw new SignatureError(`Array data for variant type must be an array at ${path}`)
                }
                for (let i = 0; i < data.length; i++) {
                    this.writeVariant(data[i], `${path}[${i}]`)
                }
            } else {
                // Normal array, elements can be basic types
                if (!Array.isArray(data)) {
                    throw new SignatureError(`Array data must be an array at ${path}`)
                }
                for (let i = 0; i < data.length; i++) {
                    // For header fields, skip alignment for the last element to avoid final padding
                    const elementPath = path === '' && eleType.type === '(' && i === data.length - 1 ? `${path}[${i}][last-no-align]` : `${path}[${i}]`
                    this.writeTree(eleType, data[i], elementPath)
                }
            }
        }

        // Calculate array length and update placeholder (do not include post-array padding for header fields)
        let arrayLength = this.#position - startPos
        const tempPos = this.#position
        this.#position = lengthPos
        this.#buffer.writeUInt32LE(arrayLength, this.#position) // Update array length directly without alignment
        this.#position = tempPos
        return this
    }


    /**
     * Writes a simple (basic) type to the Buffer based on the provided type code.
     * @param t - The DBus type code for the simple type to write (e.g., 'y', 'i', 's').
     * @param value - The value to write to the Buffer.
     * @returns This instance for method chaining.
     * @throws {SignatureError} If the type is unsupported.
     */
    public writeSimpleType(t: string, value: any): this {
        switch (t) {
            case 'y':
                return this.writeInt8(value) // 8-bit unsigned integer, no alignment
            case 'b':
                return this.writeInt32(value ? 1 : 0) // Boolean (stored as 32-bit integer), align to 4 bytes
            case 'n':
                return this.writeSInt16(value) // 16-bit signed integer, align to 2 bytes
            case 'q':
                return this.writeInt16(value) // 16-bit unsigned integer, align to 2 bytes
            case 'u':
                return this.writeInt32(value) // 32-bit unsigned integer, align to 4 bytes
            case 'i':
                return this.writeSInt32(value) // 32-bit signed integer, align to 4 bytes
            case 'g':
                this.writeInt8(value.length) // Signature string length, no alignment
                return this.writeString(value) // Signature string content, no alignment
            case 's':
            case 'o':
                const strBuffer = Buffer.from(value, 'utf8')
                this.writeInt32(strBuffer.length, true) // Use byte length, skip alignment for variant context
                return this.writeString(value) // String or object path content, no alignment
            case 'x':
                return this.writeSInt64(BigInt(value)) // 64-bit signed integer, align to 8 bytes
            case 't':
                return this.writeInt64(BigInt(value)) // 64-bit unsigned integer, align to 8 bytes
            case 'd':
                return this.writeDouble(value) // Double precision floating point, align to 8 bytes
            default:
                throw new SignatureError(`Unsupported type: ${t}`)
        }
    }

    /**
     * Returns a subarray of the Buffer containing the written data from the start to the current position.
     * @returns A Buffer slice containing the written data.
     */
    public toBuffer(): Buffer {
        return this.#buffer.subarray(0, this.#position)
    }
}
