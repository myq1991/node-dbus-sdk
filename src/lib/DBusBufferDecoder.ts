import {DBusMessageEndianness} from './enums/DBusMessageEndianness'
import {DBusSignedValue} from './DBusSignedValue'
import {Signature} from './Signature'
import {DataType} from '../types/DataType'
import {AlignmentError, InvalidValueError, ReadBufferError, SignatureError} from './Errors'
import {DBusTypeClass} from './DBusTypeClass'
import {SignedValueToTypeClassInstance} from './SignedValueToTypeClassInstance'

/**
 * A decoder for reading DBus data from a binary buffer, following the DBus wire format.
 * Supports various DBus data types with proper alignment and endianness handling.
 * This class provides methods to decode basic types (e.g., integers, strings) and
 * container types (e.g., arrays, structs) as per the DBus specification.
 */
export class DBusBufferDecoder {
    /**
     * The endianness of the buffer data (Little Endian or Big Endian).
     * Default is Little Endian (LE) as specified by DBusMessageEndianness.LE,
     * which determines how multi-byte values are read from the buffer.
     */
    public readonly endianness: DBusMessageEndianness = DBusMessageEndianness.LE

    /**
     * The binary buffer containing the DBus data to be decoded.
     * This holds the raw bytes that the decoder reads from during operation.
     */
    protected buffer: Buffer

    /**
     * The current reading position (offset) in the buffer.
     * Incremented as data is read from the buffer, tracking the progress of decoding.
     */
    protected offset: number = 0

    /**
     * Creates a new DBusBufferDecoder instance.
     * Initializes the decoder with the specified endianness and buffer,
     * optionally setting the initial offset for reading.
     *
     * @param endianness - The endianness to use for reading multi-byte values (default: Little Endian).
     * @param buffer - The binary buffer containing the DBus data to decode.
     * @param offset - The initial offset to start reading from (default: 0).
     */
    constructor(endianness: DBusMessageEndianness = DBusMessageEndianness.LE, buffer: Buffer, offset: number = 0) {
        this.endianness = endianness
        this.buffer = buffer
        // Set the initial offset for reading from the buffer
        this.offset = offset
    }

    /**
     * Aligns the current offset to the specified byte boundary.
     * This ensures that data reads start at the correct position as per DBus alignment rules,
     * adding padding bytes to the offset if necessary.
     *
     * @param alignment - The byte boundary to align to (e.g., 1, 2, 4, 8).
     * @returns The instance itself for method chaining.
     * @throws {AlignmentError} If the aligned offset would exceed the buffer length.
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
     * Reads a BYTE type value from the buffer.
     * BYTE is an 8-bit unsigned integer with no specific alignment requirement (1-byte alignment).
     *
     * @returns The byte value (0-255) wrapped in a DBusSignedValue instance with signature 'y'.
     * @throws {ReadBufferError} If there are not enough bytes left in the buffer to read a BYTE.
     */
    public readByte(): DBusSignedValue {
        this.align(1) // Ensure 1-byte alignment (no practical effect since BYTE has no alignment requirement)
        // Check if there is enough data in the buffer to read 1 byte
        if (this.offset + 1 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read BYTE: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        // Read an 8-bit unsigned integer from the current offset
        const value: number = this.buffer.readUInt8(this.offset)
        this.offset += 1 // Increment offset by 1 byte
        return new DBusSignedValue('y', value)
    }

    /**
     * Reads a BOOLEAN type value from the buffer.
     * BOOLEAN is stored as a 32-bit unsigned integer (0 for false, 1 for true) and requires 4-byte alignment.
     *
     * @returns The boolean value (true or false) wrapped in a DBusSignedValue instance with signature 'b'.
     * @throws {ReadBufferError} If there are not enough bytes left in the buffer to read a BOOLEAN.
     * @throws {InvalidValueError} If the read value is neither 0 nor 1.
     */
    public readBoolean(): DBusSignedValue {
        this.align(4) // Ensure 4-byte alignment for the 32-bit integer
        // Check if there is enough data in the buffer to read 4 bytes
        if (this.offset + 4 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read BOOLEAN: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: number
        // Read the value based on the specified endianness
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readUInt32LE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readUInt32BE(this.offset) // Read as big-endian
        }
        this.offset += 4 // Increment offset by 4 bytes
        // Validate that the value is either 0 (false) or 1 (true)
        if (value !== 0 && value !== 1) {
            throw new InvalidValueError(`Invalid BOOLEAN value: ${value}. Must be 0 (false) or 1 (true)`)
        }
        // Convert numeric value to boolean: 1 is true, 0 is false
        const booleanValue = value === 1
        return new DBusSignedValue('b', booleanValue)
    }

    /**
     * Reads an INT16 type value from the buffer.
     * INT16 is a 16-bit signed integer and requires 2-byte alignment.
     *
     * @returns The 16-bit signed integer value wrapped in a DBusSignedValue instance with signature 'n'.
     * @throws {ReadBufferError} If there are not enough bytes left in the buffer to read an INT16.
     */
    public readInt16(): DBusSignedValue {
        this.align(2) // Ensure 2-byte alignment for the 16-bit integer
        // Check if there is enough data in the buffer to read 2 bytes
        if (this.offset + 2 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read INT16: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: number
        // Read the value based on the specified endianness
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readInt16LE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readInt16BE(this.offset) // Read as big-endian
        }
        this.offset += 2 // Increment offset by 2 bytes
        return new DBusSignedValue('n', value)
    }

    /**
     * Reads a UINT16 type value from the buffer.
     * UINT16 is a 16-bit unsigned integer and requires 2-byte alignment.
     *
     * @returns The 16-bit unsigned integer value wrapped in a DBusSignedValue instance with signature 'q'.
     * @throws {ReadBufferError} If there are not enough bytes left in the buffer to read a UINT16.
     */
    public readUInt16(): DBusSignedValue {
        this.align(2) // Ensure 2-byte alignment for the 16-bit integer
        // Check if there is enough data in the buffer to read 2 bytes
        if (this.offset + 2 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read UINT16: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: number
        // Read the value based on the specified endianness
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readUInt16LE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readUInt16BE(this.offset) // Read as big-endian
        }
        this.offset += 2 // Increment offset by 2 bytes
        return new DBusSignedValue('q', value)
    }

    /**
     * Reads an INT32 type value from the buffer.
     * INT32 is a 32-bit signed integer and requires 4-byte alignment.
     *
     * @returns The 32-bit signed integer value wrapped in a DBusSignedValue instance with signature 'i'.
     * @throws {ReadBufferError} If there are not enough bytes left in the buffer to read an INT32.
     */
    public readInt32(): DBusSignedValue {
        this.align(4) // Ensure 4-byte alignment for the 32-bit integer
        // Check if there is enough data in the buffer to read 4 bytes
        if (this.offset + 4 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read INT32: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: number
        // Read the value based on the specified endianness
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readInt32LE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readInt32BE(this.offset) // Read as big-endian
        }
        this.offset += 4 // Increment offset by 4 bytes
        return new DBusSignedValue('i', value)
    }

    /**
     * Reads a UINT32 type value from the buffer.
     * UINT32 is a 32-bit unsigned integer and requires 4-byte alignment.
     *
     * @returns The 32-bit unsigned integer value wrapped in a DBusSignedValue instance with signature 'u'.
     * @throws {ReadBufferError} If there are not enough bytes left in the buffer to read a UINT32.
     */
    public readUInt32(): DBusSignedValue {
        this.align(4) // Ensure 4-byte alignment for the 32-bit integer
        // Check if there is enough data in the buffer to read 4 bytes
        if (this.offset + 4 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read UINT32: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: number
        // Read the value based on the specified endianness
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readUInt32LE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readUInt32BE(this.offset) // Read as big-endian
        }
        this.offset += 4 // Increment offset by 4 bytes
        return new DBusSignedValue('u', value)
    }

    /**
     * Reads an INT64 type value from the buffer.
     * INT64 is a 64-bit signed integer and requires 8-byte alignment.
     *
     * @returns The 64-bit signed integer value as a bigint wrapped in a DBusSignedValue instance with signature 'x'.
     * @throws {ReadBufferError} If there are not enough bytes left in the buffer to read an INT64.
     */
    public readInt64(): DBusSignedValue {
        this.align(8) // Ensure 8-byte alignment for the 64-bit integer
        // Check if there is enough data in the buffer to read 8 bytes
        if (this.offset + 8 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read INT64: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: bigint
        // Read the value based on the specified endianness
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readBigInt64LE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readBigInt64BE(this.offset) // Read as big-endian
        }
        this.offset += 8 // Increment offset by 8 bytes
        return new DBusSignedValue('x', value)
    }

    /**
     * Reads a UINT64 type value from the buffer.
     * UINT64 is a 64-bit unsigned integer and requires 8-byte alignment.
     *
     * @returns The 64-bit unsigned integer value as a bigint wrapped in a DBusSignedValue instance with signature 't'.
     * @throws {ReadBufferError} If there are not enough bytes left in the buffer to read a UINT64.
     */
    public readUInt64(): DBusSignedValue {
        this.align(8) // Ensure 8-byte alignment for the 64-bit integer
        // Check if there is enough data in the buffer to read 8 bytes
        if (this.offset + 8 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read UINT64: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: bigint
        // Read the value based on the specified endianness
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readBigUInt64LE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readBigUInt64BE(this.offset) // Read as big-endian
        }
        this.offset += 8 // Increment offset by 8 bytes
        return new DBusSignedValue('t', value)
    }

    /**
     * Reads a DOUBLE type value from the buffer.
     * DOUBLE is a 64-bit double-precision floating-point number and requires 8-byte alignment.
     *
     * @returns The double-precision floating-point value wrapped in a DBusSignedValue instance with signature 'd'.
     * @throws {ReadBufferError} If there are not enough bytes left in the buffer to read a DOUBLE.
     */
    public readDouble(): DBusSignedValue {
        this.align(8) // Ensure 8-byte alignment for the 64-bit double
        // Check if there is enough data in the buffer to read 8 bytes
        if (this.offset + 8 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read DOUBLE: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: number
        // Read the value based on the specified endianness
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readDoubleLE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readDoubleBE(this.offset) // Read as big-endian
        }
        this.offset += 8 // Increment offset by 8 bytes
        return new DBusSignedValue('d', value)
    }

    /**
     * Reads a UNIX_FD type value from the buffer.
     * UNIX_FD is a 32-bit unsigned integer representing a file descriptor index and requires 4-byte alignment.
     *
     * @returns The file descriptor index wrapped in a DBusSignedValue instance with signature 'h'.
     * @throws {ReadBufferError} If there are not enough bytes left in the buffer to read a UNIX_FD.
     */
    public readUnixFD(): DBusSignedValue {
        this.align(4) // Ensure 4-byte alignment for the 32-bit integer
        // Check if there is enough data in the buffer to read 4 bytes
        if (this.offset + 4 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read UNIX_FD: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        let value: number
        // Read the value based on the specified endianness
        if (this.endianness === DBusMessageEndianness.LE) {
            value = this.buffer.readUInt32LE(this.offset) // Read as little-endian
        } else {
            value = this.buffer.readUInt32BE(this.offset) // Read as big-endian
        }
        this.offset += 4 // Increment offset by 4 bytes
        return new DBusSignedValue('h', value)
    }

    /**
     * Reads a STRING type value from the buffer.
     * STRING consists of a 32-bit length field followed by UTF-8 encoded characters and a null terminator.
     * The length field requires 4-byte alignment.
     *
     * @returns The string value wrapped in a DBusSignedValue instance with signature 's'.
     * @throws {ReadBufferError} If there are not enough bytes left in the buffer to read the STRING length or content.
     * @throws {ReadBufferError} If the null terminator is not found or is invalid.
     */
    public readString(): DBusSignedValue {
        this.align(4) // Ensure 4-byte alignment for the length field
        // Check if there is enough data in the buffer to read the length field (4 bytes)
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

        // Check if there is enough data to read the string content plus the null terminator
        if (this.offset + length + 1 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read STRING content: offset ${this.offset} + length ${length} + 1 exceeds buffer length ${this.buffer.length}`)
        }

        // Read the string content as UTF-8 encoded text
        const value: string = this.buffer.toString('utf8', this.offset, this.offset + length)
        this.offset += length // Increment offset by string length

        // Check and skip the null terminator (must be 0)
        const nullTerminator: number = this.buffer.readUInt8(this.offset)
        if (nullTerminator !== 0) {
            throw new ReadBufferError(`Invalid STRING: expected null terminator at offset ${this.offset}, but found ${nullTerminator}`)
        }
        this.offset += 1 // Increment offset by 1 byte for null terminator

        return new DBusSignedValue('s', value)
    }

    /**
     * Reads an OBJECT_PATH type value from the buffer.
     * OBJECT_PATH is a string with specific formatting rules, stored like STRING with a 32-bit length field.
     * The length field requires 4-byte alignment.
     *
     * @returns The object path as a string wrapped in a DBusSignedValue instance with signature 'o'.
     * @throws {ReadBufferError} If there are not enough bytes left in the buffer to read the OBJECT_PATH length or content.
     * @throws {ReadBufferError} If the null terminator is not found or is invalid.
     */
    public readObjectPath(): DBusSignedValue {
        this.align(4) // Ensure 4-byte alignment for the length field
        // Check if there is enough data in the buffer to read the length field (4 bytes)
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

        // Check if there is enough data to read the object path content plus the null terminator
        if (this.offset + length + 1 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read OBJECT_PATH content: offset ${this.offset} + length ${length} + 1 exceeds buffer length ${this.buffer.length}`)
        }

        // Read the object path content as UTF-8 encoded text
        const value: string = this.buffer.toString('utf8', this.offset, this.offset + length)
        this.offset += length // Increment offset by path length

        // Check and skip the null terminator (must be 0)
        const nullTerminator: number = this.buffer.readUInt8(this.offset)
        if (nullTerminator !== 0) {
            throw new ReadBufferError(`Invalid OBJECT_PATH: expected null terminator at offset ${this.offset}, but found ${nullTerminator}`)
        }
        this.offset += 1 // Increment offset by 1 byte for null terminator

        return new DBusSignedValue('o', value)
    }

    /**
     * Reads a SIGNATURE type value from the buffer.
     * SIGNATURE is a string of type codes with a 1-byte length field and no specific alignment requirement.
     *
     * @returns The signature as a string wrapped in a DBusSignedValue instance with signature 'g'.
     * @throws {ReadBufferError} If there are not enough bytes left in the buffer to read the SIGNATURE length or content.
     * @throws {ReadBufferError} If the null terminator is not found or is invalid.
     */
    public readSignature(): DBusSignedValue {
        // No alignment needed for 1-byte length field
        // Check if there is enough data in the buffer to read the length field (1 byte)
        if (this.offset + 1 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read SIGNATURE length: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }

        // Read the length of the signature (8-bit unsigned integer)
        const length: number = this.buffer.readUInt8(this.offset)
        this.offset += 1 // Increment offset by 1 byte for length field

        // Check if there is enough data to read the signature content plus the null terminator
        if (this.offset + length + 1 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read SIGNATURE content: offset ${this.offset} + length ${length} + 1 exceeds buffer length ${this.buffer.length}`)
        }

        // Read the signature content as ASCII text
        const value: string = this.buffer.toString('ascii', this.offset, this.offset + length)
        this.offset += length // Increment offset by signature length

        // Check and skip the null terminator (must be 0)
        const nullTerminator: number = this.buffer.readUInt8(this.offset)
        if (nullTerminator !== 0) {
            throw new ReadBufferError(`Invalid SIGNATURE: expected null terminator at offset ${this.offset}, but found ${nullTerminator}`)
        }
        this.offset += 1 // Increment offset by 1 byte for null terminator

        return new DBusSignedValue('g', value)
    }

    /**
     * Reads an ARRAY type value from the buffer.
     * ARRAY starts with a 32-bit length field (total byte length of array data) and requires 4-byte alignment.
     * Elements are read within a sub-buffer to isolate alignment.
     *
     * @param elementType - The DataType of the array elements, required for parsing elements.
     * @returns The array of elements wrapped in a DBusSignedValue instance with signature 'a{elementType}'.
     * @throws {ReadBufferError} If there are not enough bytes left in the buffer to read the ARRAY length or content.
     */
    public readArray(elementType: DataType): DBusSignedValue {
        this.align(4) // Ensure 4-byte alignment for the length field
        // Check if there is enough data in the buffer to read the length field (4 bytes)
        if (this.offset + 4 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read ARRAY length: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }
        // Read the byte length of the array data (32-bit unsigned integer)
        let byteLength: number
        if (this.endianness === DBusMessageEndianness.LE) {
            byteLength = this.buffer.readUInt32LE(this.offset) // Read length as little-endian
        } else {
            byteLength = this.buffer.readUInt32BE(this.offset) // Read length as big-endian
        }
        this.offset += 4 // Increment offset by 4 bytes for length field
        switch (elementType.type) {
            case '{':
            case '(':
                this.align(8) // Special case: dictionary entries require 8-byte alignment
        }
        // Calculate the end offset of the array data
        const arrayEndOffset = this.offset + byteLength
        // Extract a sub-buffer for the array data to isolate reading
        const arrayBuffer = this.buffer.subarray(this.offset, arrayEndOffset)
        // Create a new decoder instance for the array sub-buffer to manage local offset
        const arrayDecoder = new DBusBufferDecoder(this.endianness, arrayBuffer)
        const elements: DBusSignedValue[] = []
        // Read elements until the sub-buffer is fully consumed
        while (arrayDecoder.offset < arrayBuffer.length) {
            const element = arrayDecoder.readSignedValue(elementType) // Recursively read each element
            elements.push(element)
        }
        // Update the main offset to the end of the array data
        this.offset = arrayEndOffset
        return new DBusSignedValue({type: 'a', child: [elementType]}, elements)
    }

    /**
     * Reads a STRUCT type value from the buffer.
     * STRUCT is a sequence of fields and requires 8-byte alignment at the start.
     *
     * @param fieldTypes - The DataType array representing the types of struct fields.
     * @returns The struct value as an array of fields wrapped in a DBusSignedValue instance with signature '('.
     * @throws {SignatureError} If field types are not provided or empty.
     */
    public readStruct(fieldTypes?: DataType[]): DBusSignedValue {
        this.align(8) // Ensure 8-byte alignment for struct start as per DBus specification
        // Validate that field types are provided and not empty
        if (!fieldTypes || fieldTypes.length === 0) {
            throw new SignatureError('Field types for STRUCT are not provided or empty')
        }

        // Read each field of the struct based on its type
        const fields: DBusSignedValue[] = []
        for (const fieldType of fieldTypes) {
            // Recursively read each field, alignment is handled by specific read methods
            const fieldValue = this.readSignedValue(fieldType)
            fields.push(fieldValue)
        }

        // Return a DBusSignedValue with signature '(' for struct, containing field values
        return new DBusSignedValue('(', fields)
    }

    /**
     * Reads a DICT_ENTRY type value from the buffer.
     * DICT_ENTRY is a key-value pair used in dictionaries and requires 8-byte alignment at the start.
     *
     * @param keyType - The DataType representing the key type of the dictionary entry.
     * @param valueType - The DataType representing the value type of the dictionary entry.
     * @returns The dictionary entry value as a key-value pair wrapped in a DBusSignedValue instance with signature '{'.
     * @throws {SignatureError} If key or value types are not provided.
     */
    public readDictEntry(keyType?: DataType, valueType?: DataType): DBusSignedValue {
        this.align(8) // Ensure 8-byte alignment for dict entry start as per DBus specification
        // Validate that key and value types are provided
        if (!keyType || !valueType) {
            throw new SignatureError('Key and value types for DICT_ENTRY are not provided')
        }

        // Read the key and value of the dictionary entry based on their types
        // Recursively read the key, alignment is handled by the specific read method
        const keyValue = this.readSignedValue(keyType)
        // Recursively read the value, alignment is handled by the specific read method
        const valueValue = this.readSignedValue(valueType)

        // Return a DBusSignedValue with signature '{' for dict entry, containing key and value
        return new DBusSignedValue('{', [keyValue, valueValue])
    }

    /**
     * Reads a VARIANT type value from the buffer.
     * VARIANT is a dynamic type container with a signature field followed by data, no specific alignment required.
     *
     * @returns The variant value wrapped in a DBusSignedValue instance with signature 'v'.
     * @throws {ReadBufferError} If there are not enough bytes left in the buffer to read the VARIANT signature or content.
     * @throws {SignatureError} If the variant signature does not describe exactly one type.
     */
    public readVariant(): DBusSignedValue {
        // No alignment needed for variant (signature length field is 1 byte)
        // Check if there is enough data in the buffer to read the signature length field (1 byte)
        if (this.offset + 1 > this.buffer.length) {
            throw new ReadBufferError(`Cannot read VARIANT signature length: offset ${this.offset} exceeds buffer length ${this.buffer.length}`)
        }

        // Read the signature of the contained type
        const signatureValue: DBusSignedValue = this.readSignature()

        // Extract the signature string from the DBusSignedValue
        const variantSignature = signatureValue.$value as string

        // Parse the signature string to get the corresponding DataType(s)
        const dataTypes: DataType[] = Signature.parseSignature(variantSignature)

        // Validate that the variant signature describes exactly one type
        if (dataTypes.length !== 1) {
            throw new SignatureError(`VARIANT signature must describe exactly one type, got: ${variantSignature}`)
        }
        const dataType: DataType = dataTypes[0]

        // Read the actual value based on the parsed signature
        const variantContent: DBusSignedValue = this.readSignedValue(dataType)

        // Return a DBusSignedValue with signature 'v' and the contained value
        return new DBusSignedValue('v', variantContent)
    }

    /**
     * Reads a single value from the buffer based on the provided DataType.
     * Dispatches the reading to the appropriate method based on the type signature.
     * Handles both basic and container types recursively.
     *
     * @param type - The DataType describing the type to read from the buffer.
     * @returns The value wrapped in a DBusSignedValue instance with the appropriate signature.
     * @throws {SignatureError} If the type is unsupported or has invalid child types for containers.
     */
    public readSignedValue(type: DataType): DBusSignedValue {
        // Switch based on the type code to call the appropriate read method
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
                // Validate that array has exactly one child type for elements
                if (!type.child || type.child.length !== 1) {
                    throw new SignatureError('ARRAY type must have exactly one child type')
                }
                return this.readArray(type.child[0]) // Pass the element type to readArray
            case '(':
                // Validate that struct has at least one child type for fields
                if (!type.child || type.child.length === 0) {
                    throw new SignatureError('STRUCT type must have at least one child type')
                }
                return this.readStruct(type.child) // Pass the field types to readStruct
            case '{':
                // Validate that dict entry has exactly two child types (key and value)
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
     * Reads multiple values from the buffer based on the provided signature string.
     * The signature is parsed into DataType(s), and values are read accordingly, then converted to DBusTypeClass instances.
     *
     * @param signature - The DBus signature string describing the type(s) to read (e.g., 'is' for integer and string).
     * @returns An array of DBusTypeClass instances representing the read values.
     * @throws {SignatureError} If the signature is empty or invalid.
     */
    public toSignedValues(signature: string): DBusTypeClass[] {
        // Parse the signature string into an array of DataType objects
        const dataTypes: DataType[] = Signature.parseSignature(signature)

        // Validate that the signature is not empty
        if (dataTypes.length === 0) {
            throw new SignatureError('Empty signature provided')
        }

        // Read each value based on its corresponding DataType
        const results: DBusTypeClass[] = []
        for (const dataType of dataTypes) {
            const value: DBusSignedValue = this.readSignedValue(dataType)
            results.push(SignedValueToTypeClassInstance(value))
        }
        return results
    }

    /**
     * Decodes values from the buffer based on the provided signature and optionally converts them to plain JavaScript values or typed DBusTypeClass instances.
     * This method can unwrap DBusSignedValue instances into raw values for easier use or return typed instances for further processing.
     *
     * @param signature - The DBus signature string describing the type(s) to read (e.g., 'is' for integer and string).
     * @param typed - If true, returns an array of DBusTypeClass instances; if false, returns plain JavaScript values (default: false).
     * @returns An array of either plain JavaScript values or DBusTypeClass instances, based on the typed parameter.
     * @throws {SignatureError} If the signature is empty or invalid.
     */
    public decode(signature: string, typed: boolean = false): any[] {
        // Read values as DBusSignedValue instances and convert them based on the typed parameter
        return typed ? this.toSignedValues(signature) : DBusSignedValue.toJSON(this.toSignedValues(signature) as any)
    }
}
