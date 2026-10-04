import {DBusMessageEndianness} from './enums/DBusMessageEndianness'
import {InvalidValueError, ObjectPathError, SignatureError} from './Errors'
import {DBusSignedValue} from './DBusSignedValue'
import {Signature} from './Signature'
import {DataType} from '../types/DataType'

/**
 * Alignment in bytes of each DBus type code, per the DBus specification.
 */
const ALIGNMENT: Record<string, number> = {
    y: 1, b: 4, n: 2, q: 2, i: 4, u: 4, x: 8, t: 8, d: 8, h: 4, s: 4, o: 4, g: 1, a: 4, '(': 8, '{': 8, v: 1
}

/**
 * Describes a value for error messages.
 */
function describe(value: any): string {
    if (typeof value === 'string') return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value)
    if (typeof value === 'bigint') return `${value}n`
    if (value === null || typeof value !== 'object') return String(value)
    return Object.prototype.toString.call(value)
}

/**
 * Checks that a value is an integer within [min, max] (a number, or a bigint for convenience) and returns it as a number.
 *
 * @throws {InvalidValueError} Otherwise, instead of writing a truncated, wrapped or NaN value.
 */
function integer(value: any, min: number, max: number, typeName: string): number {
    const number: number = typeof value === 'bigint' ? Number(value) : value
    if (typeof number !== 'number' || !Number.isInteger(number) || number < min || number > max) {
        throw new InvalidValueError(`${typeName} must be an integer from ${min} to ${max}, got ${describe(value)}`)
    }
    return number
}

/**
 * Checks that a value is an integer within [min, max] given as a bigint, an integer number or a decimal string.
 *
 * @throws {InvalidValueError} Otherwise.
 */
function integer64(value: any, min: bigint, max: bigint, typeName: string): bigint {
    let big: bigint | undefined
    try {
        if (typeof value === 'bigint') big = value
        else if (typeof value === 'number' && Number.isInteger(value)) big = BigInt(value)
        else if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) big = BigInt(value.trim())
    } catch {
        big = undefined
    }
    if (big === undefined || big < min || big > max) {
        throw new InvalidValueError(`${typeName} must be an integer from ${min} to ${max}, got ${describe(value)}`)
    }
    return big
}

/**
 * A class for encoding data into a binary buffer following the DBus wire format.
 * Supports various DBus data types with proper alignment and endianness handling.
 * This class provides methods to encode basic types (e.g., integers, strings) and
 * container types (e.g., arrays, structs) as per the DBus specification.
 *
 * Values are appended to a growable buffer, and every value is aligned relative to the start of the encoding,
 * which must itself be 8-byte aligned in the message (true for message headers and bodies).
 */
export class DBusBufferEncoder {

    /**
     * The endianness used for encoding DBus messages.
     * Defaults to little-endian (LE) as it is the most common in DBus implementations.
     * Determines the byte order for multi-byte values in the message.
     */
    public readonly endianness: DBusMessageEndianness = DBusMessageEndianness.LE

    /**
     * Storage for the encoded bytes; only the first `length` bytes are in use, the rest is spare capacity.
     */
    protected buffer: Buffer

    /**
     * Number of bytes encoded so far.
     */
    protected length: number = 0

    /**
     * Constructor for DBusBufferEncoder.
     * Initializes the encoder with the specified endianness and an optional initial buffer.
     * Optionally aligns the buffer to a specified boundary if provided.
     *
     * @param endianness - The byte order for encoding (little-endian or big-endian, default: Little Endian).
     * @param initBuffer - An initial buffer to start with, if any (default: empty buffer).
     * @param alignment - An initial alignment requirement, if specified, to align the buffer start.
     */
    constructor(endianness: DBusMessageEndianness = DBusMessageEndianness.LE, initBuffer?: Buffer, alignment?: number) {
        this.endianness = endianness
        this.buffer = Buffer.allocUnsafe(Math.max(64, initBuffer ? initBuffer.length * 2 : 0))
        if (initBuffer) {
            initBuffer.copy(this.buffer)
            this.length = initBuffer.length
        }
        if (alignment) this.align(alignment)
    }

    /**
     * Makes room for `bytes` more bytes, growing the storage geometrically so appending stays linear overall.
     */
    protected reserve(bytes: number): void {
        const required: number = this.length + bytes
        if (required <= this.buffer.length) return
        let capacity: number = this.buffer.length * 2
        while (capacity < required) capacity *= 2
        const grown: Buffer = Buffer.allocUnsafe(capacity)
        this.buffer.copy(grown, 0, 0, this.length)
        this.buffer = grown
    }

    /**
     * Aligns the buffer to the specified boundary by adding zero bytes.
     * Ensures that the next data written starts at an offset that is a multiple of the alignment value.
     *
     * @param alignment - The byte boundary to align to (e.g., 4 for 32-bit alignment).
     * @returns This instance for method chaining.
     */
    protected align(alignment: number): this {
        const padding: number = (alignment - this.length % alignment) % alignment
        if (padding === 0) return this
        this.reserve(padding)
        this.buffer.fill(0, this.length, this.length + padding)
        this.length += padding
        return this
    }

    /**
     * Aligns and reserves space for a fixed-size value, returning the offset to write it at.
     */
    protected claim(alignment: number, size: number): number {
        this.align(alignment)
        this.reserve(size)
        const offset: number = this.length
        this.length += size
        return offset
    }

    protected get littleEndian(): boolean {
        return this.endianness === DBusMessageEndianness.LE
    }

    /**
     * Encodes a BYTE type value into the buffer.
     * BYTE is an 8-bit unsigned integer (0-255) with no specific alignment requirement.
     *
     * @param value - The byte value to encode (0-255).
     * @returns This instance for method chaining.
     */
    public writeByte(value: number): this {
        const byte: number = integer(value, 0, 0xFF, 'BYTE')
        // Claim first: growing replaces this.buffer, which must not be read before that
        const offset: number = this.claim(1, 1)
        this.buffer[offset] = byte
        return this
    }

    /**
     * Encodes a BOOLEAN type value into the buffer.
     * BOOLEAN is stored as a 32-bit integer (0 for false, 1 for true) with 4-byte alignment.
     *
     * @param value - The boolean value to encode.
     * @returns This instance for method chaining.
     */
    public writeBoolean(value: boolean): this {
        if (value !== true && value !== false && value !== 1 && value !== 0) {
            throw new InvalidValueError(`BOOLEAN must be true, false, 1 or 0, got ${describe(value)}`)
        }
        return this.writeLength(value ? 1 : 0)
    }

    /**
     * Encodes an INT16 type value into the buffer.
     * INT16 is a 16-bit signed integer with 2-byte alignment.
     *
     * @param value - The 16-bit signed integer value to encode.
     * @returns This instance for method chaining.
     */
    public writeInt16(value: number): this {
        value = integer(value, -0x8000, 0x7FFF, 'INT16')
        const offset: number = this.claim(2, 2)
        if (this.littleEndian) this.buffer.writeInt16LE(value, offset)
        else this.buffer.writeInt16BE(value, offset)
        return this
    }

    /**
     * Encodes a UINT16 type value into the buffer.
     * UINT16 is a 16-bit unsigned integer with 2-byte alignment.
     *
     * @param value - The 16-bit unsigned integer value to encode.
     * @returns This instance for method chaining.
     */
    public writeUInt16(value: number): this {
        value = integer(value, 0, 0xFFFF, 'UINT16')
        const offset: number = this.claim(2, 2)
        if (this.littleEndian) this.buffer.writeUInt16LE(value, offset)
        else this.buffer.writeUInt16BE(value, offset)
        return this
    }

    /**
     * Encodes an INT32 type value into the buffer.
     * INT32 is a 32-bit signed integer with 4-byte alignment.
     *
     * @param value - The 32-bit signed integer value to encode.
     * @returns This instance for method chaining.
     */
    public writeInt32(value: number): this {
        value = integer(value, -0x80000000, 0x7FFFFFFF, 'INT32')
        const offset: number = this.claim(4, 4)
        if (this.littleEndian) this.buffer.writeInt32LE(value, offset)
        else this.buffer.writeInt32BE(value, offset)
        return this
    }

    /**
     * Encodes a UINT32 type value into the buffer.
     * UINT32 is a 32-bit unsigned integer with 4-byte alignment.
     *
     * @param value - The 32-bit unsigned integer value to encode.
     * @returns This instance for method chaining.
     */
    public writeUInt32(value: number): this {
        return this.writeLength(integer(value, 0, 0xFFFFFFFF, 'UINT32'))
    }

    /**
     * Writes a UINT32 computed by the encoder itself (a length or a boolean), which needs no validation.
     */
    private writeLength(value: number): this {
        const offset: number = this.claim(4, 4)
        if (this.littleEndian) this.buffer.writeUInt32LE(value, offset)
        else this.buffer.writeUInt32BE(value, offset)
        return this
    }

    /**
     * Encodes an INT64 type value into the buffer.
     * INT64 is a 64-bit signed integer with 8-byte alignment.
     *
     * @param value - The 64-bit signed integer value to encode as a bigint.
     * @returns This instance for method chaining.
     */
    public writeInt64(value: bigint): this {
        value = integer64(value, -(2n ** 63n), 2n ** 63n - 1n, 'INT64')
        const offset: number = this.claim(8, 8)
        if (this.littleEndian) this.buffer.writeBigInt64LE(value, offset)
        else this.buffer.writeBigInt64BE(value, offset)
        return this
    }

    /**
     * Encodes a UINT64 type value into the buffer.
     * UINT64 is a 64-bit unsigned integer with 8-byte alignment.
     *
     * @param value - The 64-bit unsigned integer value to encode as a bigint.
     * @returns This instance for method chaining.
     */
    public writeUInt64(value: bigint): this {
        value = integer64(value, 0n, 2n ** 64n - 1n, 'UINT64')
        const offset: number = this.claim(8, 8)
        if (this.littleEndian) this.buffer.writeBigUInt64LE(value, offset)
        else this.buffer.writeBigUInt64BE(value, offset)
        return this
    }

    /**
     * Encodes a DOUBLE type value into the buffer.
     * DOUBLE is a 64-bit IEEE 754 floating-point number with 8-byte alignment.
     *
     * @param value - The double-precision floating-point value to encode.
     * @returns This instance for method chaining.
     */
    public writeDouble(value: number): this {
        if (typeof value !== 'number') throw new InvalidValueError(`DOUBLE must be a number, got ${describe(value)}`)
        const offset: number = this.claim(8, 8)
        if (this.littleEndian) this.buffer.writeDoubleLE(value, offset)
        else this.buffer.writeDoubleBE(value, offset)
        return this
    }

    /**
     * Encodes a UNIX_FD type value into the buffer.
     * UNIX_FD is a 32-bit unsigned integer representing a file descriptor index and requires 4-byte alignment.
     *
     * @param fdIndex - The file descriptor index to encode.
     * @returns This instance for method chaining.
     */
    public writeUnixFD(fdIndex: number): this {
        return this.writeUInt32(integer(fdIndex, 0, 0xFFFFFFFF, 'UNIX_FD'))
    }

    /**
     * Encodes a STRING type value into the buffer.
     * STRING is a UTF-8 encoded string, prefixed by a 32-bit length, followed by a null terminator, with 4-byte alignment.
     *
     * @param value - The string value to encode.
     * @returns This instance for method chaining.
     */
    public writeString(value: string): this {
        if (typeof value !== 'string') throw new InvalidValueError(`STRING must be a string, got ${describe(value)}`)
        if (value.includes('\0')) throw new InvalidValueError(`STRING must not contain NUL characters, got ${describe(value)}`)
        // A lone UTF-16 surrogate has no UTF-8 encoding (Buffer would silently write U+FFFD instead)
        if (typeof (value as any).isWellFormed === 'function' && !(value as any).isWellFormed()) {
            throw new InvalidValueError(`STRING must be valid Unicode, got one with a lone surrogate: ${describe(value)}`)
        }
        const length: number = Buffer.byteLength(value, 'utf8')
        this.writeLength(length)
        this.reserve(length + 1)
        // Buffer.write rejects an offset at the end of the buffer even for zero bytes, so skip empty strings
        if (length) this.buffer.write(value, this.length, length, 'utf8')
        this.buffer[this.length + length] = 0 // Null terminator
        this.length += length + 1
        return this
    }

    /**
     * Encodes an OBJECT_PATH type value into the buffer.
     * OBJECT_PATH is a string representing a DBus object path, encoded like a STRING with 4-byte alignment.
     * Validates the path format before encoding.
     *
     * @param value - The object path string to encode.
     * @returns This instance for method chaining.
     * @throws {ObjectPathError} If the object path format is invalid.
     */
    public writeObjectPath(value: string): this {
        if (typeof value !== 'string') throw new ObjectPathError(`OBJECT_PATH must be a string, got ${describe(value)}`)
        // Validate object path format according to DBus specification
        const objectPathRegex: RegExp = /^\/(?:[a-zA-Z0-9_]+(?:\/[a-zA-Z0-9_]+)*)?$/
        if (!objectPathRegex.test(value)) throw new ObjectPathError(`Invalid DBus object path: "${value}". Object path must start with '/' and consist of elements separated by '/', where each element starts with a letter or underscore and contains only letters, numbers, or underscores.`)
        return this.writeString(value)
    }

    /**
     * Encodes a SIGNATURE type value into the buffer.
     * SIGNATURE is a string of type codes, prefixed by an 8-bit length, followed by a null terminator, with 1-byte alignment.
     *
     * @param value - The signature string to encode.
     * @returns This instance for method chaining.
     * @throws {SignatureError} If the signature length exceeds 255 bytes.
     */
    public writeSignature(value: string): this {
        if (typeof value !== 'string') throw new SignatureError(`SIGNATURE must be a string, got ${describe(value)}`)
        const length: number = Buffer.byteLength(value, 'utf8')
        // Validate signature length does not exceed 255 bytes (SIGNATURE length field is 8-bit unsigned integer)
        if (length > 255) throw new SignatureError(`DBus signature length exceeds maximum of 255 bytes: "${value}"`)
        Signature.parseSignature(value) // Throws for anything that is not a valid signature
        return this.writeSignatureBytes(value, length)
    }

    /**
     * Writes a signature known to be valid (e.g. one built from a type), skipping validation.
     */
    private writeSignatureBytes(value: string, length: number = Buffer.byteLength(value, 'utf8')): this {
        this.reserve(length + 2)
        this.buffer[this.length] = length
        if (length) this.buffer.write(value, this.length + 1, length, 'utf8')
        this.buffer[this.length + 1 + length] = 0 // Null terminator
        this.length += length + 2
        return this
    }

    /**
     * Encodes an ARRAY type value into the buffer.
     * ARRAY is a sequence of elements of the same type, prefixed by a 32-bit length (in bytes) with 4-byte alignment.
     * The elements start at the next boundary of the element type's alignment, even when the array is empty; that
     * padding is not counted in the length.
     *
     * @param signedValues - An array of DBusSignedValue instances representing the elements to encode.
     * @param arrayItemSignature - The type code of the array elements (e.g., 'i', '{', '(').
     * @returns This instance for method chaining.
     */
    public writeArray(signedValues: DBusSignedValue[], arrayItemSignature?: string): this {
        const elementType: string | undefined = arrayItemSignature || signedValues[0]?.$signature
        const lengthOffset: number = this.claim(4, 4) // Filled in once the elements are written
        this.align(elementType ? ALIGNMENT[elementType] || 1 : 1)
        const start: number = this.length
        for (const signedValue of signedValues) {
            this.writeSignedValue(signedValue)
        }
        const contentLength: number = this.length - start
        if (this.littleEndian) this.buffer.writeUInt32LE(contentLength, lengthOffset)
        else this.buffer.writeUInt32BE(contentLength, lengthOffset)
        return this
    }

    /**
     * Encodes a STRUCT type value into the buffer.
     * STRUCT is a sequence of fields of potentially different types, with 8-byte alignment at the start.
     *
     * @param signedValues - An array of DBusSignedValue instances representing the struct fields.
     * @returns This instance for method chaining.
     */
    public writeStruct(signedValues: DBusSignedValue[]): this {
        this.align(8)
        for (const signedValue of signedValues) {
            this.writeSignedValue(signedValue)
        }
        return this
    }

    /**
     * Encodes a DICT_ENTRY type value into the buffer.
     * DICT_ENTRY is a key-value pair with 8-byte alignment, used within arrays to form dictionaries.
     *
     * @param signedValues - An array of exactly two DBusSignedValue instances (key and value).
     * @returns This instance for method chaining.
     * @throws {SignatureError} If the number of elements is not exactly 2.
     */
    public writeDictEntry(signedValues: DBusSignedValue[]): this {
        // Ensure dictionary entry contains exactly two elements (key and value)
        if (signedValues.length !== 2) {
            throw new SignatureError(`Dictionary entry must contain exactly 2 elements (key and value), got ${signedValues.length}`)
        }
        this.align(8)
        this.writeSignedValue(signedValues[0]) // Encode key
        this.writeSignedValue(signedValues[1]) // Encode value
        return this
    }

    /**
     * Encodes a VARIANT type value into the buffer.
     * VARIANT is a dynamic type container with a signature followed by the value, with 1-byte alignment.
     *
     * @param signedValue - The DBusSignedValue instance representing the variant's content.
     * @returns This instance for method chaining.
     */
    public writeVariant(signedValue: DBusSignedValue): this {
        // Built from the content's type, which the parser has already checked
        this.writeSignatureBytes(this.variantSignature(signedValue))
        return this.writeSignedValue(signedValue)
    }

    /**
     * The complete signature of a variant's content: known directly for basic types and recorded empty arrays,
     * otherwise rebuilt from the content.
     */
    private variantSignature(signedValue: DBusSignedValue): string {
        const dataType: DataType | undefined = DBusSignedValue.dataTypeOf(signedValue)
        if (dataType && Signature.isComplete(dataType)) return Signature.stringify(dataType)
        return this.buildSignature(signedValue)
    }

    /**
     * Reconstructs the complete signature string for a DBusSignedValue.
     * Handles both basic types and container types (arrays, structs, dictionaries) recursively.
     *
     * @param signedValue - The DBusSignedValue instance to build the signature for.
     * @returns The complete signature string.
     * @throws {SignatureError} If the signature cannot be built due to unsupported types or inconsistent structures.
     */
    private buildSignature(signedValue: DBusSignedValue): string {
        const dataType: DataType | undefined = DBusSignedValue.dataTypeOf(signedValue)
        if (dataType && Signature.isComplete(dataType)) return Signature.stringify(dataType)
        // Basic types return their signature directly
        if (!'a({v'.includes(signedValue.$signature)) {
            return signedValue.$signature
        }
        // Handle container types recursively
        switch (signedValue.$signature) {
            case 'a': {
                const values: DBusSignedValue[] = signedValue.$value as DBusSignedValue[]
                if (values.length === 0) {
                    // Only a basic element type can be known from the array itself
                    const itemSignature: string | undefined = signedValue.$arrayItemSignature
                    if (itemSignature && !'a({'.includes(itemSignature)) return `a${itemSignature}`
                    throw new SignatureError('Cannot build signature for empty array in variant')
                }
                // Get the signature of the first element
                const firstElementSignature: string = this.buildSignature(values[0])
                // Check if all elements have the same signature
                const isConsistent: boolean = values.every((val: DBusSignedValue): boolean => this.buildSignature(val) === firstElementSignature)
                if (isConsistent) return `a${firstElementSignature}`
                // If inconsistent, check if it matches a dictionary structure like 'a{sv}'
                const isDictArray: boolean = values.every((val: DBusSignedValue): boolean => val.$signature === '{')
                if (isDictArray) {
                    const firstDictEntry: DBusSignedValue[] = values[0].$value as DBusSignedValue[]
                    if (firstDictEntry.length === 2) {
                        const firstKeySignature: string = this.buildSignature(firstDictEntry[0])
                        const firstValueSignature: string = this.buildSignature(firstDictEntry[1])
                        const areKeysConsistent: boolean = values.every((val: DBusSignedValue): boolean => this.buildSignature((val.$value as DBusSignedValue[])[0]) === firstKeySignature)
                        const areValuesConsistent: boolean = values.every((val: DBusSignedValue): boolean => this.buildSignature((val.$value as DBusSignedValue[])[1]) === firstValueSignature)
                        return `a{${areKeysConsistent ? firstKeySignature : 'v'}${areValuesConsistent ? firstValueSignature : 'v'}}`
                    }
                }
                throw new SignatureError('Cannot build signature for array with inconsistent element types in variant')
            }
            case '(': {
                // Struct: signature is '(' followed by field signatures and ')'
                const fieldSignedValues: DBusSignedValue[] = signedValue.$value as DBusSignedValue[]
                return `(${fieldSignedValues.map((field: DBusSignedValue): string => this.buildSignature(field)).join('')})`
            }
            case '{': {
                // Dictionary entry: signature is '{' followed by key and value signatures and '}'
                const [keySignedValue, valueSignedValue] = signedValue.$value as DBusSignedValue[]
                return `{${this.buildSignature(keySignedValue)}${this.buildSignature(valueSignedValue)}}`
            }
            default:
                // Variant: signature is 'v' directly, not the internal value's signature
                return 'v'
        }
    }

    /**
     * Encodes a DBusSignedValue into the buffer based on its signature.
     * Routes the encoding to the appropriate method based on the type signature of the value.
     *
     * @param signedValue - The DBusSignedValue instance to encode.
     * @returns This instance for method chaining.
     * @throws {SignatureError} If the signature type is unsupported.
     */
    public writeSignedValue(signedValue: DBusSignedValue): this {
        // Route encoding based on the signature type
        switch (signedValue.$signature) {
            // Basic data types
            case 'y':
                return this.writeByte(signedValue.$value)
            case 'b':
                return this.writeBoolean(signedValue.$value)
            case 'n':
                return this.writeInt16(signedValue.$value)
            case 'q':
                return this.writeUInt16(signedValue.$value)
            case 'u':
                return this.writeUInt32(signedValue.$value)
            case 'i':
                return this.writeInt32(signedValue.$value)
            case 'g':
                return this.writeSignature(signedValue.$value)
            case 's':
                return this.writeString(signedValue.$value)
            case 'o':
                return this.writeObjectPath(signedValue.$value)
            case 'x':
                return this.writeInt64(BigInt(signedValue.$value))
            case 't':
                return this.writeUInt64(BigInt(signedValue.$value))
            case 'd':
                return this.writeDouble(signedValue.$value)
            case 'h':
                return this.writeUnixFD(signedValue.$value)
            // Container data types
            case 'a':
                return this.writeArray(signedValue.$value, signedValue.$arrayItemSignature)
            case '(':
                return this.writeStruct(signedValue.$value)
            case '{':
                return this.writeDictEntry(signedValue.$value)
            case 'v':
                return this.writeVariant(signedValue.$value)
            default:
                throw new SignatureError(`Unsupported type: ${signedValue.$signature}`)
        }
    }

    /**
     * Retrieves the current encoded buffer.
     * Returns the buffer containing all data encoded so far.
     *
     * @returns The current buffer with encoded data.
     */
    public getBuffer(): Buffer {
        return this.buffer.subarray(0, this.length)
    }

    /**
     * Encodes a value or set of values based on a DBus signature.
     * Parses the input value(s) into DBusSignedValue instances based on the signature and encodes them into the buffer.
     *
     * @param signature - The DBus signature defining the type(s) of the value(s) to encode.
     * @param value - The value(s) to encode, can be raw data or already wrapped as DBusSignedValue(s).
     * @param debug - If true, logs the parsed DBusSignedValue instances for debugging purposes (default: false).
     * @returns The encoded buffer containing the data.
     */
    public encode(signature: string, value: any | DBusSignedValue | DBusSignedValue[], debug: boolean = false): Buffer {
        // Parse the input value(s) into signed values based on the signature
        const signedValues: DBusSignedValue[] = DBusSignedValue.parse(signature, value)
        if (debug) console.log(JSON.stringify(signedValues, null, 2))
        // Encode each signed value
        for (const signedValue of signedValues) {
            this.writeSignedValue(signedValue)
        }
        return this.getBuffer()
    }
}
