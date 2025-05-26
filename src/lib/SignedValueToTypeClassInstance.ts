import {DBusSignedValue} from './DBusSignedValue'
import {DBusTypeClass} from './DBusTypeClass'
import {DBusByte} from './datatypes/DBusByte'
import {DBusBoolean} from './datatypes/DBusBoolean'
import {DBusInt16} from './datatypes/DBusInt16'
import {DBusUint16} from './datatypes/DBusUint16'
import {DBusUint32} from './datatypes/DBusUint32'
import {DBusInt32} from './datatypes/DBusInt32'
import {DBusSignature} from './datatypes/DBusSignature'
import {DBusString} from './datatypes/DBusString'
import {DBusObjectPath} from './datatypes/DBusObjectPath'
import {DBusInt64} from './datatypes/DBusInt64'
import {DBusUint64} from './datatypes/DBusUint64'
import {DBusDouble} from './datatypes/DBusDouble'
import {DBusUnixFD} from './datatypes/DBusUnixFD'
import {DBusArray} from './datatypes/DBusArray'
import {DBusStruct} from './datatypes/DBusStruct'
import {DBusDictEntry} from './datatypes/DBusDictEntry'
import {DBusVariant} from './datatypes/DBusVariant'
import {SignatureError} from './Errors'

/**
 * An array of DBus type class constructors used for mapping DBus type signatures to their corresponding class implementations.
 * This array includes constructors for all supported DBus data types, both basic and container types, to facilitate type conversion and instantiation.
 */
const typeClassConstructors: (typeof DBusTypeClass)[] = [
    DBusByte, DBusBoolean, DBusInt16, DBusUint16, DBusUint32, DBusInt32,
    DBusSignature, DBusString, DBusObjectPath, DBusInt64, DBusUint64,
    DBusDouble, DBusUnixFD, DBusArray, DBusStruct, DBusDictEntry, DBusVariant
] as (typeof DBusTypeClass)[]

/**
 * Converts a DBusSignedValue instance to a corresponding DBusTypeClass instance based on its type signature.
 * This function maps the signature of the input value to the appropriate DBus data type class (e.g., DBusByte, DBusString)
 * and recursively processes container types (e.g., arrays, structs) to build nested structures.
 *
 * @param value - The DBusSignedValue instance to convert, containing a value and its associated DBus type signature.
 * @returns A DBusTypeClass instance representing the input value in its specific DBus type class form.
 * @throws {SignatureError} If the type signature of the input value is unknown or unsupported.
 */
export function SignedValueToTypeClassInstance(value: DBusSignedValue): DBusTypeClass {
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
            return new DBusUint16(value.$value)
        case 'u':
            return new DBusUint32(value.$value)
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
            return new DBusUint64(value.$value)
        case 'd':
            return new DBusDouble(value.$value)
        case 'h':
            return new DBusUnixFD(value.$value)
        // Container data types
        case 'a':
            const arrayItemSignature: string = value.$arrayItemSignature!
            const arrayValues: DBusTypeClass[] = (value.$value as DBusSignedValue[]).map((item: DBusSignedValue): DBusTypeClass => SignedValueToTypeClassInstance(item))
            return new DBusArray(arrayValues, typeClassConstructors.find(typeClassConstructor => typeClassConstructor.type === arrayItemSignature))
        case '(':
            const structValues: DBusTypeClass[] = (value.$value as DBusSignedValue[]).map((item: DBusSignedValue): DBusTypeClass => SignedValueToTypeClassInstance(item))
            return new DBusStruct(structValues)
        case '{':
            const dictValues: [DBusTypeClass, DBusTypeClass] = (value.$value as DBusSignedValue[]).map((item: DBusSignedValue): DBusTypeClass => SignedValueToTypeClassInstance(item)) as [DBusTypeClass, DBusTypeClass]
            return new DBusDictEntry(dictValues)
        case 'v':
            const nestedValue: DBusTypeClass = SignedValueToTypeClassInstance(value.$value as DBusSignedValue)
            return new DBusVariant(nestedValue)
        default:
            throw new SignatureError(`Unknown DBus type: ${signature}`)
    }
}
