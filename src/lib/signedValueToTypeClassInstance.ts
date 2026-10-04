import {DBusSignedValue} from './DBusSignedValue'
import {DBusTypeClass} from './DBusTypeClass'
import {DBusByte} from './datatypes/DBusByte'
import {DBusBoolean} from './datatypes/DBusBoolean'
import {DBusInt16} from './datatypes/DBusInt16'
import {DBusUInt16} from './datatypes/DBusUInt16'
import {DBusUInt32} from './datatypes/DBusUInt32'
import {DBusInt32} from './datatypes/DBusInt32'
import {DBusSignature} from './datatypes/DBusSignature'
import {DBusString} from './datatypes/DBusString'
import {DBusObjectPath} from './datatypes/DBusObjectPath'
import {DBusInt64} from './datatypes/DBusInt64'
import {DBusUInt64} from './datatypes/DBusUInt64'
import {DBusDouble} from './datatypes/DBusDouble'
import {DBusUnixFD} from './datatypes/DBusUnixFD'
import {DBusArray} from './datatypes/DBusArray'
import {DBusStruct} from './datatypes/DBusStruct'
import {DBusDictEntry} from './datatypes/DBusDictEntry'
import {DBusVariant} from './datatypes/DBusVariant'
import {SignatureError} from './Errors'

/**
 * Converts a DBusSignedValue instance to a corresponding DBusTypeClass instance based on its type signature.
 * This function maps the signature of the input value to the appropriate DBus data type class (e.g., DBusByte, DBusString)
 * and recursively processes container types (e.g., arrays, structs) to build nested structures.
 *
 * @param value - The DBusSignedValue instance to convert, containing a value and its associated DBus type signature.
 * @returns A DBusTypeClass instance representing the input value in its specific DBus type class form.
 * @throws {SignatureError} If the type signature of the input value is unknown or unsupported.
 */
export function signedValueToTypeClassInstance(value: DBusSignedValue): DBusTypeClass {
    return toTypeClassInstance(value)
}

function toTypeClassInstance(value: DBusSignedValue): DBusTypeClass {
    const signature = value.$signature
    // Handle basic types with direct mapping to DBusTypeClass-derived classes
    switch (signature) {
        // Basic data types
        case 'y':
            return new DBusByte(value.$value)
        case 'b':
            return new DBusBoolean(value.$value)
        case 'n':
            return new DBusInt16(value.$value)
        case 'q':
            return new DBusUInt16(value.$value)
        case 'u':
            return new DBusUInt32(value.$value)
        case 'i':
            return new DBusInt32(value.$value)
        case 'g':
            return new DBusSignature(value.$value)
        case 's':
            return new DBusString(value.$value)
        case 'o':
            return new DBusObjectPath(value.$value)
        case 'x':
            return new DBusInt64(value.$value)
        case 't':
            return new DBusUInt64(value.$value)
        case 'd':
            return new DBusDouble(value.$value)
        case 'h':
            return new DBusUnixFD(value.$value)
        // Container data types
        case 'a': {
            if (Buffer.isBuffer(value.$value)) {
                // Typed results hold one DBusByte per byte
                return new DBusArray(Array.from(value.$value, (byte: number): DBusTypeClass => new DBusByte(byte)), DBusByte)
            }
            const items: DBusSignedValue[] = value.$value as DBusSignedValue[]
            if (items.length) return new DBusArray(items.map((item: DBusSignedValue): DBusTypeClass => toTypeClassInstance(item)))
            // An empty array keeps its complete element type, e.g. 'a{sv}' for an empty 'aa{sv}'
            return new DBusArray([], DBusSignedValue.completeSignature(value).substring(1))
        }
        case '(':
            const structValues: DBusTypeClass[] = (value.$value as DBusSignedValue[]).map((item: DBusSignedValue): DBusTypeClass => toTypeClassInstance(item))
            return new DBusStruct(structValues)
        case '{':
            const dictValues: [DBusTypeClass, DBusTypeClass] = (value.$value as DBusSignedValue[]).map((item: DBusSignedValue): DBusTypeClass => toTypeClassInstance(item)) as [DBusTypeClass, DBusTypeClass]
            return new DBusDictEntry(dictValues)
        case 'v':
            const nestedValue: DBusTypeClass = toTypeClassInstance(value.$value as DBusSignedValue)
            return new DBusVariant(nestedValue)
        default:
            throw new SignatureError(`Unknown DBus type: ${signature}`)
    }
}
