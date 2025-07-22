import {Signature} from './Signature'
import {DataType} from '../types/DataType'
import {SignatureError} from './Errors'

/**
 * A class representing a DBus signed value with a specific signature and associated data.
 * This class wraps a value with its corresponding DBus type signature, enabling proper
 * encoding and decoding of DBus messages. It supports both basic types (e.g., integers, strings)
 * and container types (e.g., arrays, structs, dictionaries) as defined by the DBus specification.
 */
export class DBusSignedValue {
    /**
     * The signature of the DBus value (e.g., 's' for string, 'i' for integer, 'a' for array).
     * This identifies the type of data stored in the value according to the DBus type system.
     */
    public readonly $signature: string

    /**
     * The signature of the array item (for 'a' type), if applicable.
     * This is used to specify the type of elements within an array, particularly useful
     * for distinguishing different array contents (e.g., 'ay' for byte array).
     */
    public readonly $arrayItemSignature?: string

    /**
     * The value associated with the signature.
     * Can be a primitive (e.g., number, string), a single DBusSignedValue (for nested types like variants),
     * or an array of DBusSignedValue instances (for containers like arrays or structs).
     */
    public readonly $value: any | DBusSignedValue | DBusSignedValue[]

    /**
     * Static method to parse a DBus signature and value into an array of DBusSignedValue objects.
     * Distinguishes between independent parameter sequences (e.g., 'si' for string and integer)
     * and structs (e.g., '(si)' for a struct containing string and integer).
     * This method is useful for creating properly typed DBus values from raw data.
     *
     * @param signature - The DBus signature string (e.g., 's', 'si', '(si)', 'as') defining the type structure.
     * @param value - The value or values corresponding to the signature, can be raw data or already DBusSignedValue.
     * @returns An array of DBusSignedValue objects representing the parsed signature and value.
     * @throws {SignatureError} If the value structure does not match the signature or is invalid.
     */
    public static parse(signature: string, value: any | DBusSignedValue | DBusSignedValue[]): DBusSignedValue[] {
        // Parse the signature string into an array of DataType objects
        const dataTypes: DataType[] = Signature.parseSignature(signature)

        // Check if the signature represents a struct (starts with '(' and ends with ')')
        const isStruct: boolean = signature.trim().startsWith('(') && signature.trim().endsWith(')')

        if (dataTypes.length > 1 && !isStruct) {
            // If the signature has multiple types and is not a struct, treat it as an independent parameter sequence (e.g., 'si')
            let values: any[]
            if (Array.isArray(value)) {
                values = value // Use array directly if provided
            } else if (typeof value === 'object' && value !== null) {
                values = Object.values(value) // Convert object to array of values if provided as object
            } else {
                throw new SignatureError(`Expected array or object for multi-type signature, got: ${typeof value}`)
            }

            if (values.length !== dataTypes.length) {
                throw new SignatureError(`Value length (${values.length}) does not match signature length (${dataTypes.length})`)
            }

            // Create independent DBusSignedValue objects for each type and corresponding value
            // Check if the value is already a DBusSignedValue instance
            return dataTypes.map((dataType: DataType, index: number): DBusSignedValue =>
                values[index] instanceof DBusSignedValue ? values[index] : new DBusSignedValue(dataType, values[index])
            )
        } else {
            // For single types, structs, or other composite types, return a single DBusSignedValue object
            // If value is already a DBusSignedValue instance and matches the signature, return it directly
            if (value instanceof DBusSignedValue && dataTypes.length === 1 && value.$signature === dataTypes[0].type) {
                return [value]
            }
            return [new DBusSignedValue(dataTypes, value)]
        }
    }

    /**
     * Static method to convert an array of DBusSignedValue objects back to plain JavaScript objects.
     * Recursively processes nested structures (arrays, structs, dictionaries) and removes DBus
     * signature metadata to return raw values suitable for general use.
     *
     * @param values - An array of DBusSignedValue objects to convert.
     * @returns An array of plain JavaScript values representing the data without DBus signatures.
     */
    public static toJSON(values: DBusSignedValue[]): any[] {
        return values.map((value: DBusSignedValue): any => DBusSignedValue.convertToPlain(value))
    }

    /**
     * Private static method to recursively convert a single DBusSignedValue object to a plain JavaScript value.
     * Handles different DBus types (basic, array, dictionary, struct, variant) and unwraps nested structures.
     *
     * @param value - The DBusSignedValue object to convert.
     * @returns The plain JavaScript value extracted from the DBusSignedValue.
     */
    private static convertToPlain(value: DBusSignedValue): any {
        // If the value is a basic type (not a composite type), return the raw value
        if (!Array.isArray(value.$value) && !(value.$value instanceof DBusSignedValue)) {
            return value.$value
        }

        // Handle different signature types for container structures
        switch (value.$signature) {
            case 'a': // Array
                const arrayValues: any[] = (value.$value as DBusSignedValue[]).map(item => DBusSignedValue.convertToPlain(item))
                // Check if the array represents a dictionary array (e.g., a{sv})
                if (arrayValues.length > 0 && typeof arrayValues[0] === 'object' && !Array.isArray(arrayValues[0])) {
                    // Merge dictionary entries into a single object
                    return arrayValues.reduce((acc, curr) => ({...acc, ...curr}), {})
                }
                // Check if the array represents a byte array (ay)
                if (arrayValues.length > 0 && Array.isArray(value.$value) && value.$value.length > 0 && (value.$value as DBusSignedValue[])[0].$signature === 'y') {
                    // Convert to Buffer for byte array
                    return Buffer.from(arrayValues as number[])
                }
                // Handle empty dictionary array case
                if (!arrayValues.length && value.$arrayItemSignature === '{') {
                    return {}
                }
                return arrayValues
            case '{': // Dictionary (key-value pair)
                const [key, val] = value.$value as DBusSignedValue[]
                return {
                    [DBusSignedValue.convertToPlain(key) as string]: DBusSignedValue.convertToPlain(val)
                }
            case '(': // Struct
                return (value.$value as DBusSignedValue[]).map(item => DBusSignedValue.convertToPlain(item))
            case 'v': // Variant
                return DBusSignedValue.convertToPlain(value.$value as DBusSignedValue)
            default:
                // For nested structures or unsupported types, recursively process if it's a DBusSignedValue
                if (value.$value instanceof DBusSignedValue) {
                    return DBusSignedValue.convertToPlain(value.$value)
                } else if (Array.isArray(value.$value)) {
                    return value.$value.map((item: any) =>
                        item instanceof DBusSignedValue ? DBusSignedValue.convertToPlain(item) : item
                    )
                }
                return value.$value
        }
    }

    /**
     * Constructor for creating a DBusSignedValue object from a signature and value.
     * Processes the signature (string, DataType, or array of DataType) and associates it with the provided value,
     * handling basic types, structs, arrays, dictionaries, and variants appropriately.
     *
     * @param signature - The DBus signature, as a string (e.g., 's'), a single DataType, or an array of DataType for structs.
     * @param value - The value associated with the signature, can be raw data, DBusSignedValue, or array of values.
     * @throws {SignatureError} If the value structure does not match the signature or if the type is unsupported.
     */
    constructor(signature: string | DataType | DataType[], value: any | DBusSignedValue | DBusSignedValue[]) {
        // Handle signature input: parse string to DataType array, or use directly if already DataType or array
        const dataTypes: DataType[] = typeof signature === 'string'
            ? signature.length > 1 ? Signature.parseSignature(signature) : [{type: <any>signature}]
            : Array.isArray(signature)
                ? signature
                : [signature]

        // If the signature contains multiple types, infer it as a struct or sequence
        if (dataTypes.length > 1) {
            this.$signature = '(' // Struct signature
            let structValues: any[]
            if (Array.isArray(value)) {
                structValues = value // Use array directly if provided
            } else if (typeof value === 'object' && value !== null) {
                structValues = Object.values(value) // Convert object to array of values if provided as object
            } else {
                throw new SignatureError(`Expected array or object for struct signature "()", got: ${typeof value}`)
            }
            if (structValues.length !== dataTypes.length) {
                throw new SignatureError(`Struct value length (${structValues.length}) does not match signature child length (${dataTypes.length})`)
            }
            // Check if each value is already a DBusSignedValue instance
            this.$value = structValues.map((item, index) => {
                if (item instanceof DBusSignedValue) {
                    // If the item is a DBusSignedValue and the corresponding type is 'v', wrap it in a variant structure
                    if (dataTypes[index].type === 'v') {
                        return new DBusSignedValue('v', item)
                    }
                    return item
                }
                return new DBusSignedValue(dataTypes[index], item)
            })
        } else {
            const dataType: DataType = dataTypes[0]
            this.$signature = dataType.type // Extract the type as the signature for single type

            // Set $arrayItemSignature for array type 'a'
            if (dataType.type === 'a' && dataType.child && dataType.child.length > 0) {
                this.$arrayItemSignature = dataType.child[0].type
            }

            // Process value based on type
            if (dataType.type === 'v') {
                // Special handling for variant type
                if (value instanceof DBusSignedValue) {
                    // If value is already a DBusSignedValue instance, use it directly (it will be wrapped in variant structure by caller if needed)
                    this.$value = value
                } else {
                    // Otherwise, infer signature from value type
                    const inferredType: string = this.inferType(value)
                    const inferredDataType: DataType = Signature.parseSignature(inferredType)[0]
                    this.$value = new DBusSignedValue(inferredDataType, value)
                }
            } else if (dataType.child && dataType.child.length > 0) {
                // Handle composite types: array, dictionary, struct
                switch (dataType.type) {
                    case 'a': // Array
                        // Check if value is an array or TypedArray-like object
                        const isArrayLike: boolean = Array.isArray(value) || (typeof value === 'object' && value !== null && 'length' in value && typeof value.length === 'number' && value.length >= 0)
                        if (!isArrayLike) {
                            // For dictionary arrays a{...}, support object input
                            if (dataType.child[0].type === '{' && typeof value === 'object' && value !== null) {
                                const entries: [string, unknown][] = Object.entries(value)
                                if (entries.length === 0) {
                                    // If the input is an empty object, create an empty array with the correct signature structure
                                    this.$value = []
                                } else {
                                    this.$value = entries.map(([key, val]): DBusSignedValue => {
                                        // Use parsed DataType objects directly to avoid re-parsing
                                        const keyDataType: DataType | undefined = dataType.child![0].child?.[0]
                                        const valueDataType: DataType | undefined = dataType.child![0].child?.[1]
                                        if (!keyDataType || !valueDataType) {
                                            throw new SignatureError('Invalid dictionary child types')
                                        }
                                        const keyObj: DBusSignedValue = new DBusSignedValue(keyDataType, key)
                                        const valObj: DBusSignedValue = new DBusSignedValue(valueDataType, val)
                                        // Create a DBusSignedValue for a single dictionary entry {...}
                                        return new DBusSignedValue(dataType.child![0], [keyObj, valObj])
                                    })
                                }
                                break
                            } else if (dataType.child[0].type === 'y' && Buffer.isBuffer(value)) {
                                // For 'ay' type, convert Buffer to array if provided
                                const arrayValue: number[] = Array.from(value)
                                this.$value = arrayValue.map(byte => new DBusSignedValue('y', byte))
                                break
                            }
                            throw new SignatureError(`Expected array for signature "a", got: ${typeof value}. Non-dictionary array types do not support object input except for Buffer with ay.`)
                        }
                        // Handle Array or TypedArray for array type
                        if (dataType.child[0].type === 'v') {
                            // If child type is variant, check if elements are DBusSignedValue instances
                            this.$value = Array.from(value).map((item: any) =>
                                item instanceof DBusSignedValue
                                    ? new DBusSignedValue('v', item) // Wrap in variant structure
                                    : new DBusSignedValue(dataType.child![0], item)
                            )
                        } else {
                            // For non-variant child types, check if elements are DBusSignedValue instances
                            this.$value = Array.from(value).map((item: any) =>
                                item instanceof DBusSignedValue ? item : new DBusSignedValue(dataType.child![0], item)
                            )
                        }
                        break

                    case '{': // Dictionary (single key-value pair)
                        if (dataType.child.length !== 2) {
                            throw new SignatureError('Dictionary signature "{}" must have exactly 2 child types')
                        }
                        if (Array.isArray(value)) {
                            // Support array format for key-value pair
                            if (value.length !== 2) {
                                throw new SignatureError(`Expected key-value pair array of length 2 for dictionary signature "{}", got length: ${value.length}`)
                            }
                            // Check if elements in value are already DBusSignedValue instances
                            this.$value = value.map((item: any, index: number): DBusSignedValue =>
                                item instanceof DBusSignedValue
                                    ? item
                                    : new DBusSignedValue(dataType.child![index], item)
                            )
                        } else if (typeof value === 'object' && value !== null) {
                            // For single dictionary entry, take the first key-value pair
                            const entries: [string, unknown][] = Object.entries(value)
                            if (entries.length !== 1) {
                                throw new SignatureError(`Expected object with exactly one key-value pair for dictionary signature "{}", got ${entries.length} pairs`)
                            }
                            const [key, val] = entries[0]
                            this.$value = [
                                <any>key instanceof DBusSignedValue ? key : new DBusSignedValue(dataType.child[0], key),
                                <any>val instanceof DBusSignedValue ? val : new DBusSignedValue(dataType.child[1], val)
                            ]
                        } else {
                            throw new SignatureError(`Expected array or object with one key-value pair for dictionary signature "{}", got: ${typeof value}`)
                        }
                        break

                    case '(': // Struct
                        let structValues: any[]
                        if (Array.isArray(value)) {
                            structValues = value // Use array directly if provided
                        } else if (typeof value === 'object' && value !== null) {
                            // If input is an object, convert to array based on value order
                            structValues = Object.values(value)
                        } else {
                            throw new SignatureError(`Expected array or object for struct signature "()", got: ${typeof value}`)
                        }
                        if (structValues.length !== dataType.child.length) {
                            throw new SignatureError(`Struct value length (${structValues.length}) does not match signature child length (${dataType.child.length})`)
                        }
                        // Check if each value is already a DBusSignedValue instance
                        this.$value = structValues.map((item: any, index: number) => {
                            if (item instanceof DBusSignedValue) {
                                // If the item is a DBusSignedValue and the corresponding type is 'v', wrap it in a variant structure
                                if (dataType.child![index].type === 'v') {
                                    return new DBusSignedValue('v', item)
                                }
                                return item
                            }
                            return new DBusSignedValue(dataType.child![index], item)
                        })
                        break

                    default:
                        throw new SignatureError(`Unsupported composite type: "${dataType.type}"`)
                }
            } else {
                // Basic type, store value directly without further wrapping
                this.$value = value
            }
        }
    }

    /**
     * Private method to infer the DBus signature type from a value for variant type 'v'.
     * Analyzes the type and structure of the value to determine an appropriate DBus signature.
     * Handles basic types (strings, numbers), arrays, buffers, and objects for dictionary inference.
     *
     * @param value - The value to infer the type from, can be any JavaScript value.
     * @returns The inferred DBus signature string (e.g., 's' for string, 'ai' for integer array).
     */
    private inferType(value: any): string {
        // If value is already a DBusSignedValue instance, use its signature
        if (value instanceof DBusSignedValue) {
            return value.$signature
        }

        // Infer signature based on value type and structure
        if (typeof value === 'string') {
            return 's' // String
        } else if (typeof value === 'number') {
            // Check if integer or floating-point
            return Number.isInteger(value) ? 'i' : 'd' // Integer or double
        } else if (typeof value === 'boolean') {
            return 'b' // Boolean
        } else if (typeof value === 'bigint') {
            return 'x' // 64-bit integer
        } else if (Buffer.isBuffer(value)) {
            return 'ay' // Byte array
        } else if (value instanceof Uint8Array) {
            return 'ay' // Byte array
        } else if (value instanceof Int8Array) {
            return 'an' // 16-bit integer array (approximation)
        } else if (value instanceof Uint16Array) {
            return 'aq' // 16-bit unsigned integer array
        } else if (value instanceof Int16Array) {
            return 'an' // 16-bit integer array
        } else if (value instanceof BigUint64Array) {
            return 'at' // 64-bit unsigned integer array
        } else if (value instanceof BigInt64Array) {
            return 'ax' // 64-bit integer array
        } else if (Array.isArray(value) || (typeof value === 'object' && value !== null && 'length' in value && typeof value.length === 'number' && value.length >= 0)) {
            // Array or TypedArray, attempt to infer child type
            if (value.length === 0) {
                return 'ai' // Default empty array to integer array
            }
            // Check if it might be a dictionary array (each element is an object)
            const firstItem = value[0]
            if (typeof firstItem === 'object' && firstItem !== null && !Buffer.isBuffer(firstItem) && !(firstItem instanceof Uint8Array) && !('length' in firstItem && typeof firstItem.length === 'number')) {
                const keys = Object.keys(firstItem)
                if (keys.length > 0) {
                    // Infer as dictionary array a{sv}
                    return 'a{sv}'
                }
            }
            // Check if all elements have the same type
            const items = Array.from(value)
            const firstType = this.inferType(firstItem)
            const allSameType = items.every(item => this.inferType(item) === firstType)
            if (!allSameType) {
                // If types are inconsistent, infer as struct
                const childTypes = items.map(item => this.inferType(item))
                return `(${childTypes.join('')})`
            }
            // Otherwise, treat as regular array with child type based on first element
            return `a${firstType}`
        } else if (typeof value === 'object' && value !== null) {
            // Object, infer as dictionary array
            const entries = Object.entries(value)
            if (entries.length === 0) {
                return 'a{sv}' // Default empty object to string-variant dictionary
            }
            // Prefer to infer as dictionary array a{sv}, with string keys and variant values
            return 'a{sv}'
        } else {
            // Default to string type for unsupported or unknown types
            return 's'
        }
    }
}
