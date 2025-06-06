import {DBusMessageEndianness} from './enums/DBusMessageEndianness'
import {ObjectPathError, SignatureError} from './Errors'
import {DBusSignedValue} from './DBusSignedValue'

/**
 * A class for encoding data into a binary buffer following the DBus wire format.
 * Supports various DBus data types with proper alignment and endianness handling.
 * This class provides methods to encode basic types (e.g., integers, strings) and
 * container types (e.g., arrays, structs) as per the DBus specification.
 */
export class DBusBufferEncoder {

    /**
     * The endianness used for encoding DBus messages.
     * Defaults to little-endian (LE) as it is the most common in DBus implementations.
     * Determines the byte order for multi-byte values in the message.
     */
    public readonly endianness: DBusMessageEndianness = DBusMessageEndianness.LE

    /**
     * The binary buffer where encoded DBus data is stored.
     * This holds the raw bytes that are built during encoding operations.
     */
    protected buffer: Buffer

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
        this.buffer = initBuffer ? initBuffer : Buffer.alloc(0)
        if (alignment) this.align(alignment)
    }

    /**
     * Aligns the buffer to the specified byte boundary.
     * Adds padding bytes (zeros) to ensure the buffer length meets the alignment requirement,
     * which is necessary for certain DBus data types.
     *
     * @param alignment - The byte boundary to align to (e.g., 1, 2, 4, 8).
     * @returns The instance itself for method chaining.
     * @protected
     */
    protected align(alignment: number): this {
        // Calculate the remainder and required padding for alignment
        const remainder: number = this.buffer.length % alignment
        if (remainder === 0) return this // Buffer is already aligned, no action needed
        const padding: number = alignment - remainder
        const paddingBuffer: Buffer = Buffer.alloc(padding, 0) // Create padding with zeros
        this.buffer = Buffer.concat([this.buffer, paddingBuffer]) // Append padding to the buffer
        return this
    }

    /**
     * Encodes a BYTE type value into the buffer.
     * BYTE is an 8-bit unsigned integer with no specific alignment requirement (1-byte alignment).
     *
     * @param value - The byte value to encode (0-255).
     * @returns The instance itself for method chaining.
     */
    public writeByte(value: number): this {
        this.align(1)
        const buffer: Buffer = Buffer.alloc(1)
        buffer.writeUInt8(value & 0xFF, 0) // Ensure value is in the range 0-255
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * Encodes a BOOLEAN type value into the buffer.
     * BOOLEAN is stored as a 32-bit unsigned integer (0 for false, 1 for true) and requires 4-byte alignment.
     *
     * @param value - The boolean value to encode (true or false).
     * @returns The instance itself for method chaining.
     */
    public writeBoolean(value: boolean): this {
        this.align(4)
        const buffer: Buffer = Buffer.alloc(4) // BOOLEAN occupies 4 bytes
        const intValue: 0 | 1 = value ? 1 : 0 // Encode true as 1, false as 0
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeUInt32LE(intValue, 0) // Little-endian byte order
        } else {
            buffer.writeUInt32BE(intValue, 0) // Big-endian byte order
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * Encodes an INT16 type value into the buffer.
     * INT16 is a 16-bit signed integer and requires 2-byte alignment.
     *
     * @param value - The 16-bit signed integer value to encode.
     * @returns The instance itself for method chaining.
     */
    public writeInt16(value: number): this {
        this.align(2)
        const buffer: Buffer = Buffer.alloc(2) // INT16 occupies 2 bytes
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeInt16LE(value, 0) // Little-endian byte order
        } else {
            buffer.writeInt16BE(value, 0) // Big-endian byte order
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * Encodes a UINT16 type value into the buffer.
     * UINT16 is a 16-bit unsigned integer and requires 2-byte alignment.
     *
     * @param value - The 16-bit unsigned integer value to encode.
     * @returns The instance itself for method chaining.
     */
    public writeUInt16(value: number): this {
        this.align(2)
        const buffer: Buffer = Buffer.alloc(2) // UINT16 occupies 2 bytes
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeUInt16LE(value, 0) // Little-endian byte order
        } else {
            buffer.writeUInt16BE(value, 0) // Big-endian byte order
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * Encodes an INT32 type value into the buffer.
     * INT32 is a 32-bit signed integer and requires 4-byte alignment.
     *
     * @param value - The 32-bit signed integer value to encode.
     * @returns The instance itself for method chaining.
     */
    public writeInt32(value: number): this {
        this.align(4)
        const buffer: Buffer = Buffer.alloc(4) // INT32 occupies 4 bytes
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeInt32LE(value, 0) // Little-endian byte order
        } else {
            buffer.writeInt32BE(value, 0) // Big-endian byte order
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * Encodes a UINT32 type value into the buffer.
     * UINT32 is a 32-bit unsigned integer and requires 4-byte alignment.
     *
     * @param value - The 32-bit unsigned integer value to encode.
     * @returns The instance itself for method chaining.
     */
    public writeUInt32(value: number): this {
        this.align(4)
        const buffer: Buffer = Buffer.alloc(4) // UINT32 occupies 4 bytes
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeUInt32LE(value, 0) // Little-endian byte order
        } else {
            buffer.writeUInt32BE(value, 0) // Big-endian byte order
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * Encodes an INT64 type value into the buffer.
     * INT64 is a 64-bit signed integer and requires 8-byte alignment.
     *
     * @param value - The 64-bit signed integer value to encode, provided as a bigint.
     * @returns The instance itself for method chaining.
     */
    public writeInt64(value: bigint): this {
        this.align(8)
        const buffer: Buffer = Buffer.alloc(8) // INT64 occupies 8 bytes
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeBigInt64LE(value, 0) // Little-endian byte order
        } else {
            buffer.writeBigInt64BE(value, 0) // Big-endian byte order
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * Encodes a UINT64 type value into the buffer.
     * UINT64 is a 64-bit unsigned integer and requires 8-byte alignment.
     *
     * @param value - The 64-bit unsigned integer value to encode, provided as a bigint.
     * @returns The instance itself for method chaining.
     */
    public writeUInt64(value: bigint): this {
        this.align(8)
        const buffer: Buffer = Buffer.alloc(8) // UINT64 occupies 8 bytes
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeBigUInt64LE(value, 0) // Little-endian byte order
        } else {
            buffer.writeBigUInt64BE(value, 0) // Big-endian byte order
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * Encodes a DOUBLE type value into the buffer.
     * DOUBLE is a 64-bit double-precision floating-point number and requires 8-byte alignment.
     *
     * @param value - The double-precision floating-point value to encode.
     * @returns The instance itself for method chaining.
     */
    public writeDouble(value: number): this {
        this.align(8)
        const buffer: Buffer = Buffer.alloc(8) // DOUBLE occupies 8 bytes
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeDoubleLE(value, 0) // Little-endian byte order
        } else {
            buffer.writeDoubleBE(value, 0) // Big-endian byte order
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * Encodes a UNIX_FD type value into the buffer.
     * UNIX_FD is a 32-bit unsigned integer representing a file descriptor index and requires 4-byte alignment.
     *
     * @param fdIndex - The file descriptor index to encode.
     * @returns The instance itself for method chaining.
     */
    public writeUnixFD(fdIndex: number): this {
        this.align(4)
        const buffer: Buffer = Buffer.alloc(4) // UNIX_FD occupies 4 bytes
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeUInt32LE(fdIndex, 0) // Little-endian byte order
        } else {
            buffer.writeUInt32BE(fdIndex, 0) // Big-endian byte order
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * Encodes a STRING type value into the buffer.
     * STRING consists of a 32-bit length field followed by UTF-8 encoded characters and a null terminator.
     * The length field requires 4-byte alignment.
     *
     * @param value - The string value to encode.
     * @returns The instance itself for method chaining.
     */
    public writeString(value: string): this {
        this.align(4)
        const stringBuffer: Buffer = Buffer.from(value, 'utf8') // Convert string to UTF-8 encoded buffer
        const length: number = stringBuffer.length // Get byte length of the string
        const totalLength: number = 4 + length + 1 // 4-byte length field + string content + 1-byte null terminator
        const buffer: Buffer = Buffer.alloc(totalLength) // Allocate buffer for total length
        // Write length field as a 32-bit unsigned integer
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeUInt32LE(length, 0) // Little-endian byte order
        } else {
            buffer.writeUInt32BE(length, 0) // Big-endian byte order
        }
        // Write string content
        stringBuffer.copy(buffer, 4) // Copy string content starting at offset 4
        // Write null terminator at the end
        buffer.writeUInt8(0, 4 + length) // Write null byte after string content
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * Encodes an OBJECT_PATH type value into the buffer.
     * OBJECT_PATH is a string with specific formatting rules, stored like STRING with a 32-bit length field.
     * The length field requires 4-byte alignment.
     *
     * @param value - The object path string to encode.
     * @returns The instance itself for method chaining.
     * @throws {ObjectPathError} If the object path does not conform to DBus specification formatting rules.
     */
    public writeObjectPath(value: string): this {
        // Validate object path format according to DBus specification
        const objectPathRegex: RegExp = /^\/([a-zA-Z_][a-zA-Z0-9_]*)*(?:\/([a-zA-Z_][a-zA-Z0-9_]*))*$|^\/$/
        if (!objectPathRegex.test(value)) throw new ObjectPathError(`Invalid DBus object path: "${value}". Object path must start with '/' and consist of elements separated by '/', where each element starts with a letter or underscore and contains only letters, numbers, or underscores.`)
        this.align(4)
        const pathBuffer: Buffer = Buffer.from(value, 'utf8') // Convert path to UTF-8 encoded buffer
        const length: number = pathBuffer.length // Get byte length of the path
        const totalLength: number = 4 + length + 1 // 4-byte length field + path content + 1-byte null terminator
        const buffer: Buffer = Buffer.alloc(totalLength) // Allocate buffer for total length
        // Write length field as a 32-bit unsigned integer
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeUInt32LE(length, 0) // Little-endian byte order
        } else {
            buffer.writeUInt32BE(length, 0) // Big-endian byte order
        }
        // Write path content
        pathBuffer.copy(buffer, 4) // Copy path content starting at offset 4
        // Write null terminator at the end
        buffer.writeUInt8(0, 4 + length) // Write null byte after path content
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * Encodes a SIGNATURE type value into the buffer.
     * SIGNATURE is a string of type codes with a 1-byte length field and no specific alignment requirement.
     *
     * @param value - The signature string to encode.
     * @returns The instance itself for method chaining.
     * @throws {SignatureError} If the signature length exceeds the maximum allowed (255 bytes).
     */
    public writeSignature(value: string): this {
        this.align(1)
        const signatureBuffer: Buffer = Buffer.from(value, 'utf8') // Convert signature string to UTF-8 encoded buffer
        const length: number = signatureBuffer.length // Get byte length of the signature string
        // Validate signature length does not exceed 255 bytes (SIGNATURE length field is 8-bit unsigned integer)
        if (length > 255) throw new SignatureError(`DBus signature length exceeds maximum of 255 bytes: "${value}"`)
        const totalLength: number = 1 + length + 1 // 1-byte length field + signature content + 1-byte null terminator
        const buffer: Buffer = Buffer.alloc(totalLength) // Allocate buffer for total length
        // Write length field as an 8-bit unsigned integer
        buffer.writeUInt8(length, 0)
        // Write signature string content
        signatureBuffer.copy(buffer, 1) // Copy signature content starting at offset 1
        // Write null terminator at the end
        buffer.writeUInt8(0, 1 + length) // Write null byte after signature content
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * Encodes an ARRAY type value into the buffer.
     * ARRAY starts with a 32-bit length field (total byte length of array data) and requires 4-byte alignment.
     * Additional alignment may be needed for specific array element types (e.g., dictionary entries).
     *
     * @param signedValues - Array elements, each associated with a signature as DBusSignedValue instances.
     * @param arrayItemSignature - Optional signature of array elements to determine additional alignment needs.
     * @returns The instance itself for method chaining.
     */
    public writeArray(signedValues: DBusSignedValue[], arrayItemSignature?: string): this {
        this.align(4)
        // Create a temporary encoder to encode array content and calculate its length
        const contentEncoder = new DBusBufferEncoder(this.endianness, Buffer.alloc(0), 1)

        // Encode each element in the array
        for (const signedValue of signedValues) {
            contentEncoder.writeSignedValue(signedValue)
        }

        // Get the byte length of the encoded array content
        const contentBuffer: Buffer = contentEncoder.getBuffer()
        const contentLength: number = contentBuffer.length

        // Write length field as a 4-byte unsigned integer
        const lengthBuffer: Buffer = Buffer.alloc(4)
        if (this.endianness === DBusMessageEndianness.LE) {
            lengthBuffer.writeUInt32LE(contentLength, 0) // Little-endian byte order
        } else {
            lengthBuffer.writeUInt32BE(contentLength, 0) // Big-endian byte order
        }

        // Append length field to the main buffer
        this.buffer = Buffer.concat([this.buffer, lengthBuffer])

        if (arrayItemSignature) switch (arrayItemSignature) {
            case '{':
            case '(':
                this.align(8) // Special alignment for dictionary entries or structs
        }

        // Append array content to the main buffer
        this.buffer = Buffer.concat([this.buffer, contentBuffer])
        return this
    }

    /**
     * Encodes a STRUCT type value into the buffer.
     * STRUCT is a sequence of fields and requires 8-byte alignment at the start.
     *
     * @param signedValues - Struct fields, each associated with a signature as DBusSignedValue instances.
     * @returns The instance itself for method chaining.
     */
    public writeStruct(signedValues: DBusSignedValue[]): this {
        this.align(8)

        // Encode each field of the struct in sequence
        for (const signedValue of signedValues) {
            this.writeSignedValue(signedValue)
        }
        return this
    }

    /**
     * Encodes a DICT_ENTRY type value into the buffer.
     * DICT_ENTRY is a key-value pair used in dictionaries and requires 8-byte alignment at the start.
     *
     * @param signedValues - Dictionary entry as a key-value pair, must contain exactly two elements (key and value), each as a DBusSignedValue.
     * @returns The instance itself for method chaining.
     * @throws {SignatureError} If the dictionary entry does not contain exactly two elements.
     */
    public writeDictEntry(signedValues: DBusSignedValue[]): this {
        this.align(8)

        // Ensure dictionary entry contains exactly two elements (key and value)
        if (signedValues.length !== 2) {
            throw new SignatureError(`Dictionary entry must contain exactly 2 elements (key and value), got ${signedValues.length}`)
        }

        // Encode key and value in sequence
        this.writeSignedValue(signedValues[0]) // Encode key
        this.writeSignedValue(signedValues[1]) // Encode value
        return this
    }

    /**
     * Encodes a VARIANT type value into the buffer.
     * VARIANT is a dynamic type container with a signature field followed by data, requiring no specific alignment (1-byte alignment).
     *
     * @param signedValue - Variant value, associated with a signature as a DBusSignedValue.
     * @returns The instance itself for method chaining.
     */
    public writeVariant(signedValue: DBusSignedValue): this {
        this.align(1)

        // Reconstruct the complete signature string for the variant's internal value
        const signature = this.buildSignature(signedValue)

        // Write the type signature of the variant
        this.writeSignature(signature)
        // Write the actual content of the variant
        this.writeSignedValue(signedValue)
        return this
    }

    /**
     * Builds the complete signature string for a given signed value.
     * Recursively handles nested structures like arrays, structs, dictionaries, and variants.
     *
     * @param signedValue - The signed value to build a signature for.
     * @returns The complete signature string representing the type structure of the value.
     * @throws {SignatureError} If the signature cannot be built due to invalid or unsupported types.
     * @private
     */
    private buildSignature(signedValue: DBusSignedValue): string {
        // Basic types return their signature directly
        const basicTypes = ['y', 'b', 'n', 'q', 'u', 'i', 'g', 's', 'o', 'x', 't', 'd', 'h']
        if (basicTypes.includes(signedValue.$signature)) {
            return signedValue.$signature
        }

        // Handle container types recursively
        switch (signedValue.$signature) {
            case 'a': {
                // Array: Check if the array is empty or elements have consistent signatures
                const values = signedValue.$value as DBusSignedValue[]
                if (values.length === 0) {
                    throw new SignatureError('Cannot build signature for empty array in variant')
                }

                // Get the signature of the first element
                const firstElementSignature = this.buildSignature(values[0])

                // Check if all elements have the same signature
                const isConsistent = values.every(val => this.buildSignature(val) === firstElementSignature)

                if (isConsistent) {
                    // If consistent, return 'a' followed by the element's signature
                    return `a${firstElementSignature}`
                } else {
                    // If inconsistent, check if it matches a dictionary structure like 'a{sv}'
                    // Assume dictionary array if elements are dict entries with key-value pairs
                    const isDictArray = values.every(val => val.$signature === '{')
                    if (isDictArray) {
                        // Check the structure of the dictionary entries
                        const firstDictEntry = values[0].$value as DBusSignedValue[]
                        if (firstDictEntry.length === 2) {
                            // Get signatures of key and value from the first entry
                            const firstKeySignature = this.buildSignature(firstDictEntry[0])
                            const firstValueSignature = this.buildSignature(firstDictEntry[1])

                            // Check if all dictionary entries have consistent key signatures
                            const areKeysConsistent = values.every(val => {
                                const [key] = val.$value as DBusSignedValue[]
                                return this.buildSignature(key) === firstKeySignature
                            })

                            // Check if all dictionary entries have consistent value signatures
                            const areValuesConsistent = values.every(val => {
                                const [, value] = val.$value as DBusSignedValue[]
                                return this.buildSignature(value) === firstValueSignature
                            })

                            // Build the dictionary signature based on consistency
                            const keySignature = areKeysConsistent ? firstKeySignature : 'v'
                            const valueSignature = areValuesConsistent ? firstValueSignature : 'v'
                            return `a{${keySignature}${valueSignature}}`
                        }
                    }
                    // If not a consistent dictionary array or other recognized structure, throw error
                    throw new SignatureError('Cannot build signature for array with inconsistent element types in variant')
                }
            }
            case '(': {
                // Struct: signature is '(' followed by field signatures and ')'
                const fieldSignedValues = signedValue.$value as DBusSignedValue[]
                const fieldSignatures = fieldSignedValues.map(field => this.buildSignature(field)).join('')
                return `(${fieldSignatures})`
            }
            case '{': {
                // Dictionary entry: signature is '{' followed by key and value signatures and '}'
                const [keySignedValue, valueSignedValue] = signedValue.$value as DBusSignedValue[]
                const keySignature = this.buildSignature(keySignedValue)
                const valueSignature = this.buildSignature(valueSignedValue)
                return `{${keySignature}${valueSignature}}`
            }
            case 'v': {
                // Variant: signature is 'v' directly, not the internal value's signature
                return 'v'
            }
            default:
                throw new SignatureError(`Cannot build signature for unsupported type: ${signedValue.$signature}`)
        }
    }

    /**
     * Encodes a value based on its DBus type signature.
     * Routes the encoding to the appropriate method based on the signature of the provided DBusSignedValue.
     *
     * @param signedValue - The value to encode, associated with a DBus signature as a DBusSignedValue.
     * @returns The instance itself for method chaining.
     * @throws {SignatureError} If the type signature is unsupported.
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
        return this.buffer
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
        return this.buffer
    }
}
