import {DBusMessageEndianness} from './DBusMessageEndianness'
import {DBusSignedValue} from './DBusSignedValue'
import {Signature} from './Signature'
import {DataType} from '../types/DataType'
import {AlignmentError, InvalidValueError, ReadBufferError, SignatureError} from './Errors'

export class DBusBufferDecoder {

    public readonly endianness: DBusMessageEndianness = DBusMessageEndianness.LE

    protected buffer: Buffer

    protected offset: number = 0

    constructor(endianness: DBusMessageEndianness = DBusMessageEndianness.LE, buffer: Buffer, alignment?: number) {
        this.endianness = endianness
        this.buffer = buffer
        if (alignment) this.align(alignment)
    }

    /**
     * Aligns the current offset to the specified byte boundary
     * @param alignment The byte boundary to align to (e.g., 1, 2, 4, 8)
     * @protected
     */
    protected align(alignment: number): this {
        // Calculate the remainder of the current offset divided by the alignment boundary
        const remainder: number = this.offset % alignment
        if (remainder === 0) return this // Offset is already aligned, no action needed
        // Calculate the number of padding bytes needed to reach the next aligned position
        const padding: number = alignment - remainder
        // Increment the offset by the padding amount to align it
        this.offset += padding
        // Ensure the new offset does not exceed the buffer length
        if (this.offset > this.buffer.length) {
            throw new AlignmentError(`Alignment exceeds buffer length: attempted to align to ${alignment} bytes, resulting offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        return this
    }

    /**
     * Reads a BYTE type value from the buffer
     * Buffer must be 1-byte aligned before calling this method
     * @returns The byte value (0-255) wrapped in DBusSignedValue
     */
    public readByte(): DBusSignedValue {
        this.align(1) // Ensure 1-byte alignment
        if (this.offset + 1 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read BYTE: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        const value: number = this.buffer.readUInt8(this.offset) // Read an 8-bit unsigned integer
        this.offset += 1 // Increment offset by 1 byte
        return new DBusSignedValue('y', value)
    }

    /**
     * Reads a BOOLEAN type value from the buffer
     * Buffer must be 4-byte aligned before calling this method
     * @returns The boolean value (true or false) wrapped in DBusSignedValue
     */
    public readBoolean(): DBusSignedValue {
        this.align(4) // Ensure 4-byte alignment
        if (this.offset + 4 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read BOOLEAN: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: number
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readUInt32LE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readUInt32BE(this.offset) // Read as big-endian
        }
        this.offset += 4 // Increment offset by 4 bytes
        if (value !== 0 && value !== 1) {
            throw new InvalidValueError(`Invalid BOOLEAN value: ${value}. Must be 0 (false) or 1 (true)`)
        }
        const booleanValue = value === 1 // Convert to boolean: 1 is true, 0 is false
        return new DBusSignedValue('b', booleanValue)
    }

    /**
     * Reads an INT16 type value from the buffer
     * Buffer must be 2-byte aligned before calling this method
     * @returns The 16-bit signed integer value wrapped in DBusSignedValue
     */
    public readInt16(): DBusSignedValue {
        this.align(2) // Ensure 2-byte alignment
        if (this.offset + 2 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read INT16: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: number
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readInt16LE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readInt16BE(this.offset) // Read as big-endian
        }
        this.offset += 2 // Increment offset by 2 bytes
        return new DBusSignedValue('n', value)
    }

    /**
     * Reads a UINT16 type value from the buffer
     * Buffer must be 2-byte aligned before calling this method
     * @returns The 16-bit unsigned integer value wrapped in DBusSignedValue
     */
    public readUInt16(): DBusSignedValue {
        this.align(2) // Ensure 2-byte alignment
        if (this.offset + 2 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read UINT16: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: number
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readUInt16LE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readUInt16BE(this.offset) // Read as big-endian
        }
        this.offset += 2 // Increment offset by 2 bytes
        return new DBusSignedValue('q', value)
    }

    /**
     * Reads an INT32 type value from the buffer
     * Buffer must be 4-byte aligned before calling this method
     * @returns The 32-bit signed integer value wrapped in DBusSignedValue
     */
    public readInt32(): DBusSignedValue {
        this.align(4) // Ensure 4-byte alignment
        if (this.offset + 4 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read INT32: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: number
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readInt32LE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readInt32BE(this.offset) // Read as big-endian
        }
        this.offset += 4 // Increment offset by 4 bytes
        return new DBusSignedValue('i', value)
    }

    /**
     * Reads a UINT32 type value from the buffer
     * Buffer must be 4-byte aligned before calling this method
     * @returns The 32-bit unsigned integer value wrapped in DBusSignedValue
     */
    public readUInt32(): DBusSignedValue {
        this.align(4) // Ensure 4-byte alignment
        if (this.offset + 4 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read UINT32: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: number
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readUInt32LE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readUInt32BE(this.offset) // Read as big-endian
        }
        this.offset += 4 // Increment offset by 4 bytes
        return new DBusSignedValue('u', value)
    }

    /**
     * Reads an INT64 type value from the buffer
     * Buffer must be 8-byte aligned before calling this method
     * @returns The 64-bit signed integer value as a bigint wrapped in DBusSignedValue
     */
    public readInt64(): DBusSignedValue {
        this.align(8) // Ensure 8-byte alignment
        if (this.offset + 8 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read INT64: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: bigint
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readBigInt64LE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readBigInt64BE(this.offset) // Read as big-endian
        }
        this.offset += 8 // Increment offset by 8 bytes
        return new DBusSignedValue('x', value)
    }

    /**
     * Reads a UINT64 type value from the buffer
     * Buffer must be 8-byte aligned before calling this method
     * @returns The 64-bit unsigned integer value as a bigint wrapped in DBusSignedValue
     */
    public readUInt64(): DBusSignedValue {
        this.align(8) // Ensure 8-byte alignment
        if (this.offset + 8 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read UINT64: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: bigint
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readBigUInt64LE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readBigUInt64BE(this.offset) // Read as big-endian
        }
        this.offset += 8 // Increment offset by 8 bytes
        return new DBusSignedValue('t', value)
    }

    /**
     * Reads a DOUBLE type value from the buffer
     * Buffer must be 8-byte aligned before calling this method
     * @returns The double-precision floating-point value wrapped in DBusSignedValue
     */
    public readDouble(): DBusSignedValue {
        this.align(8) // Ensure 8-byte alignment
        if (this.offset + 8 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read DOUBLE: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: number
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readDoubleLE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readDoubleBE(this.offset) // Read as big-endian
        }
        this.offset += 8 // Increment offset by 8 bytes
        return new DBusSignedValue('d', value)
    }

    /**
     * Reads a UNIX_FD type value from the buffer
     * Buffer must be 4-byte aligned before calling this method
     * @returns The file descriptor index as a 32-bit unsigned integer wrapped in DBusSignedValue
     */
    public readUnixFD(): DBusSignedValue {
        this.align(4) // Ensure 4-byte alignment
        if (this.offset + 4 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read UNIX_FD: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: number
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readUInt32LE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readUInt32BE(this.offset) // Read as big-endian
        }
        this.offset += 4 // Increment offset by 4 bytes
        return new DBusSignedValue('h', value)
    }

    /**
     * Reads a STRING type value from the buffer
     * Buffer must be 4-byte aligned before calling this method
     * @returns The string value wrapped in DBusSignedValue
     */
    public readString(): DBusSignedValue {
        this.align(4) // Ensure 4-byte alignment for length field
        if (this.offset + 4 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read STRING length: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }

        // Read the length of the string (32-bit unsigned integer)
        let length: number
        if (this.endianness === DBusMessageEndianness.LE) {
            length = this.buffer.readUInt32LE(this.offset) // Read length as little-endian
        } else {
            length = this.buffer.readUInt32BE(this.offset) // Read length as big-endian
        }
        this.offset += 4 // Increment offset by 4 bytes for length field
        // Check if we can read the string content plus the null terminator
        if (this.offset + length + 1 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read STRING content: offset ${this.offset} + length ${length} + 1 exceeds buffer length ${this.buffer.length}`)
        }

        // Read the string content
        const value: string = this.buffer.toString('utf8', this.offset, this.offset + length)
        this.offset += length // Increment offset by string length

        // Check and skip the null terminator
        const nullTerminator: number = this.buffer.readUInt8(this.offset)
        if (nullTerminator !== 0) {
            throw new ReadBufferError(`Invalid STRING: expected null terminator at offset ${this.offset}, but found ${nullTerminator}`)
        }
        this.offset += 1 // Increment offset by 1 byte for null terminator

        return new DBusSignedValue('s', value)
    }

    /**
     * Reads an OBJECT_PATH type value from the buffer
     * Buffer must be 4-byte aligned before calling this method
     * @returns The object path as a string wrapped in DBusSignedValue
     */
    public readObjectPath(): DBusSignedValue {
        this.align(4) // Ensure 4-byte alignment for length field
        if (this.offset + 4 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read OBJECT_PATH length: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }

        // Read the length of the object path (32-bit unsigned integer)
        let length: number
        if (this.endianness === DBusMessageEndianness.LE) {
            length = this.buffer.readUInt32LE(this.offset) // Read length as little-endian
        } else {
            length = this.buffer.readUInt32BE(this.offset) // Read length as big-endian
        }
        this.offset += 4 // Increment offset by 4 bytes for length field

        // Check if we can read the object path content plus the null terminator
        if (this.offset + length + 1 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read OBJECT_PATH content: offset ${this.offset} + length ${length} + 1 exceeds buffer length ${this.buffer.length}`)
        }

        // Read the object path content
        const value: string = this.buffer.toString('utf8', this.offset, this.offset + length)
        this.offset += length // Increment offset by path length

        // Check and skip the null terminator
        const nullTerminator: number = this.buffer.readUInt8(this.offset)
        if (nullTerminator !== 0) {
            throw new ReadBufferError(`Invalid OBJECT_PATH: expected null terminator at offset ${this.offset}, but found ${nullTerminator}`)
        }
        this.offset += 1 // Increment offset by 1 byte for null terminator

        return new DBusSignedValue('o', value)
    }

    /**
     * Reads a SIGNATURE type value from the buffer
     * No alignment is required for signature length field
     * @returns The signature as a string wrapped in DBusSignedValue
     */
    public readSignature(): DBusSignedValue {
        // No alignment needed for 1-byte length field
        if (this.offset + 1 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read SIGNATURE length: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }

        // Read the length of the signature (8-bit unsigned integer)
        const length: number = this.buffer.readUInt8(this.offset)
        this.offset += 1 // Increment offset by 1 byte for length field

        // Check if we can read the signature content plus the null terminator
        if (this.offset + length + 1 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read SIGNATURE content: offset ${this.offset} + length ${length} + 1 exceeds buffer length ${this.buffer.length}`)
        }

        // Read the signature content
        const value: string = this.buffer.toString('ascii', this.offset, this.offset + length)
        this.offset += length // Increment offset by signature length

        // Check and skip the null terminator
        const nullTerminator: number = this.buffer.readUInt8(this.offset)
        if (nullTerminator !== 0) {
            throw new ReadBufferError(`Invalid SIGNATURE: expected null terminator at offset ${this.offset}, but found ${nullTerminator}`)
        }
        this.offset += 1 // Increment offset by 1 byte for null terminator

        return new DBusSignedValue('g', value)
    }

    /**
     * Reads an ARRAY type value from the buffer
     * Buffer must be 4-byte aligned before calling this method
     * @param elementType The DataType of the array elements, required for parsing elements
     * @returns The array of elements wrapped in DBusSignedValue
     */
    public readArray(elementType: DataType): DBusSignedValue {
        this.align(4)
        if (this.offset + 4 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read ARRAY length: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let byteLength: number
        if (this.endianness === DBusMessageEndianness.LE) {
            byteLength = this.buffer.readUInt32LE(this.offset)
        } else {
            byteLength = this.buffer.readUInt32BE(this.offset)
        }
        this.offset += 4
        const arrayEndOffset = this.offset + byteLength
        const arrayBuffer = this.buffer.subarray(this.offset, arrayEndOffset)
        const arrayDecoder = new DBusBufferDecoder(this.endianness, arrayBuffer)
        const elements: DBusSignedValue[] = []
        while (arrayDecoder.offset < arrayBuffer.length) {
            const element = arrayDecoder.readSignedValue(elementType)
            elements.push(element)
        }
        this.offset = arrayEndOffset
        return new DBusSignedValue('a', elements)
    }

    /**
     * Reads a STRUCT type value from the buffer
     * Buffer must be 8-byte aligned before calling this method
     * @param fieldTypes The DataType array representing the types of struct fields
     * @returns The struct value wrapped in DBusSignedValue
     */
    public readStruct(fieldTypes?: DataType[]): DBusSignedValue {
        this.align(8) // Ensure 8-byte alignment for struct start
        if (!fieldTypes || fieldTypes.length === 0) {
            throw new SignatureError('Field types for STRUCT are not provided or empty')
        }

        // Read each field of the struct based on its type
        const fields: DBusSignedValue[] = []
        for (const fieldType of fieldTypes) {
            const fieldValue = this.readSignedValue(fieldType) // Recursively read each field, alignment handled by specific read methods
            fields.push(fieldValue)
        }

        // Return a DBusSignedValue with signature '(' for struct, containing field values
        return new DBusSignedValue('(', fields)
    }

    /**
     * Reads a DICT_ENTRY type value from the buffer
     * Buffer must be 8-byte aligned before calling this method
     * @param keyType The DataType representing the key type of the dictionary entry
     * @param valueType The DataType representing the value type of the dictionary entry
     * @returns The dictionary entry value wrapped in DBusSignedValue
     */
    public readDictEntry(keyType?: DataType, valueType?: DataType): DBusSignedValue {
        this.align(8) // Ensure 8-byte alignment for dict entry start
        if (!keyType || !valueType) {
            throw new SignatureError('Key and value types for DICT_ENTRY are not provided')
        }

        // Read the key and value of the dictionary entry based on their types
        const keyValue = this.readSignedValue(keyType) // Recursively read the key, alignment handled by specific read method
        const valueValue = this.readSignedValue(valueType) // Recursively read the value, alignment handled by specific read method

        // Return a DBusSignedValue with signature '{' for dict entry, containing key and value
        return new DBusSignedValue('{', [keyValue, valueValue])
    }

    /**
     * Reads a VARIANT type value from the buffer
     * No specific alignment is required for variant (follows signature alignment)
     * @returns The variant value wrapped in DBusSignedValue
     */
    public readVariant(): DBusSignedValue {
        // Read the signature of the variant content (no alignment needed for signature length field)
        if (this.offset + 1 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read VARIANT signature length: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }

        // Read the signature of the contained type
        const signatureValue: DBusSignedValue = this.readSignature()

        const variantSignature = signatureValue.$value as string // Extract the signature string from DBusSignedValue

        // Parse the signature to get the DataType(s)
        const dataTypes: DataType[] = Signature.parseSignature(variantSignature)

        if (dataTypes.length !== 1) {
            throw new SignatureError(`VARIANT signature must describe exactly one type, got: ${variantSignature}`)
        }
        const dataType: DataType = dataTypes[0]

        // Read the value based on the signature
        const variantContent: DBusSignedValue = this.readSignedValue(dataType)

        // Return a DBusSignedValue with signature 'v' and the contained value
        return new DBusSignedValue('v', variantContent)
    }

    /**
     * Reads a single value from the buffer based on the provided type
     * @param type The DataType describing the type to read
     * @returns The value wrapped in DBusSignedValue
     */
    public readSignedValue(type: DataType): DBusSignedValue {
        switch (type.type) {
            // Basic data types
            case 'y':
                return this.readByte()
            case 'b':
                return this.readBoolean()
            case 'n':
                return this.readInt16()
            case 'q':
                return this.readUInt16()
            case 'u':
                return this.readUInt32()
            case 'i':
                return this.readInt32()
            case 'g':
                return this.readSignature()
            case 's':
                return this.readString()
            case 'o':
                return this.readObjectPath()
            case 'x':
                return this.readInt64()
            case 't':
                return this.readUInt64()
            case 'd':
                return this.readDouble()
            case 'h':
                return this.readUnixFD()
            // Container data types
            case 'a':
                if (!type.child || type.child.length !== 1) {
                    throw new SignatureError('ARRAY type must have exactly one child type')
                }
                return this.readArray(type.child[0]) // Pass the element type to readArray
            case '(':
                if (!type.child || type.child.length === 0) {
                    throw new SignatureError('STRUCT type must have at least one child type')
                }
                return this.readStruct(type.child) // Pass the field types to readStruct
            case '{':
                if (!type.child || type.child.length !== 2) {
                    throw new SignatureError('DICT_ENTRY type must have exactly two child types (key and value)')
                }
                return this.readDictEntry(type.child[0], type.child[1]) // Pass the key and value types to readDictEntry
            case 'v':
                return this.readVariant() // Variant does not require child type at this level
            default:
                throw new SignatureError(`Unsupported type: ${type.type}`)
        }
    }

    /**
     * Reads values from the buffer based on the provided signature
     * @param signature The DBus signature string describing the type(s) to read
     * @returns An array of DBusSignedValue instances
     */
    public toSignedValues(signature: string): DBusSignedValue[] {
        const dataTypes: DataType[] = Signature.parseSignature(signature)

        if (dataTypes.length === 0) {
            throw new SignatureError('Empty signature provided')
        }

        const results: DBusSignedValue[] = []
        for (const dataType of dataTypes) {
            const value = this.readSignedValue(dataType)
            results.push(value)
        }
        return results
    }

    public decode(signature: string): any[] {
        return DBusSignedValue.toJSON(this.toSignedValues(signature))
    }
}