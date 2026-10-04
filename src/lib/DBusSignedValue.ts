import {Signature} from './Signature'
import {DataType} from '../types/DataType'
import {InvalidValueError, SignatureError} from './Errors'

/**
 * The complete type of empty arrays. Values only expose the first character of their type ($signature), and an
 * empty array has no items to tell the rest, which is needed to write the signature of a variant holding it
 * (e.g. an empty 'a{sv}'). Kept outside the objects so their visible shape does not change; recorded for empty
 * arrays only, because every other value's type can be rebuilt from its content.
 */
const completeTypes: WeakMap<DBusSignedValue, DataType> = new WeakMap()

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
        const dataTypes: DataType[] = Signature.parse(signature)

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
            return dataTypes.map((dataType: DataType, index: number): DBusSignedValue => DBusSignedValue.typed(dataType, values[index]))
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
    public static toPlain(values: DBusSignedValue[]): any[] {
        return values.map((value: DBusSignedValue): any => DBusSignedValue.convertToPlain(value))
    }

    /**
     * @internal
     * The complete type of a value when it is known without looking at its content: for basic types and for empty
     * arrays created with a complete signature.
     *
     * @param value - The value.
     * @returns Its type, or undefined if it has to be rebuilt from the content.
     */
    public static dataTypeOf(value: DBusSignedValue): DataType | undefined {
        const recorded: DataType | undefined = completeTypes.get(value)
        if (recorded) return recorded
        if (Buffer.isBuffer(value.$value)) return {type: 'a', child: [{type: 'y', child: []}]}
        return 'a({'.includes(value.$signature) ? undefined : {type: value.$signature as any}
    }

    /**
     * @internal
     * The complete signature of a value, e.g. 'a{sv}' where $signature only holds the type code 'a': known directly
     * for basic types and recorded empty arrays, otherwise rebuilt from the content.
     *
     * @param signedValue - The DBusSignedValue instance to build the signature for.
     * @returns The complete signature string.
     * @throws {SignatureError} If the signature cannot be built due to unsupported types or inconsistent structures.
     */
    public static completeSignature(signedValue: DBusSignedValue): string {
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
                const firstElementSignature: string = DBusSignedValue.completeSignature(values[0])
                // Check if all elements have the same signature
                const isConsistent: boolean = values.every((val: DBusSignedValue): boolean => DBusSignedValue.completeSignature(val) === firstElementSignature)
                if (isConsistent) return `a${firstElementSignature}`
                // If inconsistent, check if it matches a dictionary structure like 'a{sv}'
                const isDictArray: boolean = values.every((val: DBusSignedValue): boolean => val.$signature === '{')
                if (isDictArray) {
                    const firstDictEntry: DBusSignedValue[] = values[0].$value as DBusSignedValue[]
                    if (firstDictEntry.length === 2) {
                        const firstKeySignature: string = DBusSignedValue.completeSignature(firstDictEntry[0])
                        const firstValueSignature: string = DBusSignedValue.completeSignature(firstDictEntry[1])
                        const areKeysConsistent: boolean = values.every((val: DBusSignedValue): boolean => DBusSignedValue.completeSignature((val.$value as DBusSignedValue[])[0]) === firstKeySignature)
                        const areValuesConsistent: boolean = values.every((val: DBusSignedValue): boolean => DBusSignedValue.completeSignature((val.$value as DBusSignedValue[])[1]) === firstValueSignature)
                        return `a{${areKeysConsistent ? firstKeySignature : 'v'}${areValuesConsistent ? firstValueSignature : 'v'}}`
                    }
                }
                throw new SignatureError('Cannot build signature for array with inconsistent element types in variant')
            }
            case '(': {
                // Struct: signature is '(' followed by field signatures and ')'
                const fieldSignedValues: DBusSignedValue[] = signedValue.$value as DBusSignedValue[]
                return `(${fieldSignedValues.map((field: DBusSignedValue): string => DBusSignedValue.completeSignature(field)).join('')})`
            }
            case '{': {
                // Dictionary entry: signature is '{' followed by key and value signatures and '}'
                const [keySignedValue, valueSignedValue] = signedValue.$value as DBusSignedValue[]
                return `{${DBusSignedValue.completeSignature(keySignedValue)}${DBusSignedValue.completeSignature(valueSignedValue)}}`
            }
            default:
                // Variant: signature is 'v' directly, not the internal value's signature
                return 'v'
        }
    }

    /**
     * @internal
     * Records the complete type of a value, e.g. when converting a decoded value into a DBusTypeClass instance.
     *
     * @param value - The value.
     * @param dataType - Its complete type, or undefined to leave it unknown.
     */
    public static setDataType(value: DBusSignedValue, dataType: DataType | undefined): void {
        if (dataType?.child?.length) completeTypes.set(value, dataType)
    }

    /**
     * Converts an object property name back to a dictionary key of the given type: object keys are always strings,
     * so {1: 'a'} for a{is} or {false: 'a'} for a{bs} arrive as '1' and 'false'.
     *
     * @param type - The type code of the dictionary's keys.
     * @param name - The property name.
     * @returns The key in its own type; invalid keys are returned unchanged for the encoder to reject.
     */
    protected static keyFromPropertyName(type: string, name: string): any {
        switch (type) {
            case 'y':
            case 'n':
            case 'q':
            case 'i':
            case 'u':
            case 'h':
            case 'd':
                return name.trim() === '' ? name : Number(name)
            case 'x':
            case 't':
                return name // The encoder accepts decimal strings for 64-bit integers
            case 'b':
                return name === 'true' ? true : name === 'false' ? false : name
            default:
                return name
        }
    }

    /**
     * Converts an item to a value of the given type, the one rule for every slot (arguments, struct fields, array
     * items, dictionary keys and values): a DBusSignedValue is used as it is, except that one whose type is not
     * 'v' placed into a variant slot becomes the variant's content; anything else is converted.
     *
     * @param dataType - The type of the slot.
     * @param item - A plain value or a DBusSignedValue.
     * @returns The value for the slot.
     */
    protected static typed(dataType: DataType, item: any): DBusSignedValue {
        if (item instanceof DBusSignedValue) {
            return dataType.type === 'v' && item.$signature !== 'v' ? new DBusSignedValue('v', item) : item
        }
        return new DBusSignedValue(dataType, item)
    }

    /**
     * Private static method to recursively convert a single DBusSignedValue object to a plain JavaScript value.
     * Handles different DBus types (basic, array, dictionary, struct, variant) and unwraps nested structures.
     *
     * @param value - The DBusSignedValue object to convert.
     * @returns The plain JavaScript value extracted from the DBusSignedValue.
     */
    private static convertToPlain(value: DBusSignedValue): any {
        switch (value.$signature) {
            case 'a': {
                if (Buffer.isBuffer(value.$value)) return value.$value
                const items: DBusSignedValue[] = value.$value as DBusSignedValue[]
                const itemSignature: string | undefined = value.$arrayItemSignature || items[0]?.$signature
                if (itemSignature === '{') {
                    // An array of dictionary entries is a dictionary: one object with every entry
                    const dictionary: Record<string, any> = {}
                    for (const entry of items) {
                        const [key, entryValue] = entry.$value as DBusSignedValue[]
                        dictionary[DBusSignedValue.convertToPlain(key)] = DBusSignedValue.convertToPlain(entryValue)
                    }
                    return dictionary
                }
                if (itemSignature === 'y') {
                    const bytes: Buffer = Buffer.allocUnsafe(items.length)
                    for (let i: number = 0; i < items.length; i++) bytes[i] = items[i].$value
                    return bytes
                }
                return items.map((item: DBusSignedValue): any => DBusSignedValue.convertToPlain(item))
            }
            case '{': { // A single dictionary entry outside an array
                const [key, entryValue] = value.$value as DBusSignedValue[]
                return {[DBusSignedValue.convertToPlain(key)]: DBusSignedValue.convertToPlain(entryValue)}
            }
            case '(':
                return (value.$value as DBusSignedValue[]).map((item: DBusSignedValue): any => DBusSignedValue.convertToPlain(item))
            case 'v':
                return DBusSignedValue.convertToPlain(value.$value as DBusSignedValue)
            default:
                return value.$value instanceof DBusSignedValue ? DBusSignedValue.convertToPlain(value.$value) : value.$value
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
            ? signature.length > 1 ? Signature.parse(signature) : [{type: <any>signature}]
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
            this.$value = structValues.map((item: any, index: number): DBusSignedValue => DBusSignedValue.typed(dataTypes[index], item))
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
                    const inferredType: string = DBusSignedValue.inferSignature(value)
                    const inferredDataType: DataType = Signature.parse(inferredType)[0]
                    this.$value = new DBusSignedValue(inferredDataType, value)
                }
            } else if (dataType.child && dataType.child.length > 0) {
                // Handle composite types: array, dictionary, struct
                switch (dataType.type) {
                    case 'a': // Array
                        if (dataType.child[0].type === 'y' && value instanceof Uint8Array) {
                            // Bytes stay one Buffer (shared, not copied) instead of one value per byte
                            this.$value = Buffer.isBuffer(value) ? value : Buffer.from(value.buffer, value.byteOffset, value.byteLength)
                            break
                        }
                        // Check if value is an array or TypedArray-like object
                        const isArrayLike: boolean = Array.isArray(value) || (typeof value === 'object' && value !== null && 'length' in value && typeof value.length === 'number' && value.length >= 0)
                        if (!isArrayLike) {
                            // For dictionary arrays a{...}, support object input
                            if (dataType.child[0].type === '{' && typeof value === 'object' && value !== null) {
                                // A Map keeps its keys' types; an object's property names are converted to the key type
                                const fromMap: boolean = value instanceof Map
                                const entries: [any, unknown][] = fromMap ? [...value.entries()] : Object.entries(value)
                                if (!entries.length && !fromMap && !DBusSignedValue.isPlainObject(value)) {
                                    // A Date, Set or similar has no own properties: it would silently become an empty dictionary
                                    throw new InvalidValueError(`Cannot convert ${Object.prototype.toString.call(value)} to a DBus dictionary; convert it to a plain object, a Map, or a string or number first`)
                                }
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
                                        const keyObj: DBusSignedValue = DBusSignedValue.typed(keyDataType, fromMap ? key : DBusSignedValue.keyFromPropertyName(keyDataType.type, key))
                                        const valObj: DBusSignedValue = DBusSignedValue.typed(valueDataType, val)
                                        // Create a DBusSignedValue for a single dictionary entry {...}
                                        return new DBusSignedValue(dataType.child![0], [keyObj, valObj])
                                    })
                                }
                                break
                            }
                            throw new SignatureError(`Expected array for signature "a", got: ${typeof value}. Non-dictionary array types do not support object input except for Buffer with ay.`)
                        }
                        // Handle Array or TypedArray for array type
                        this.$value = Array.from(value).map((item: any): DBusSignedValue => DBusSignedValue.typed(dataType.child![0], item))
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
                            this.$value = value.map((item: any, index: number): DBusSignedValue => DBusSignedValue.typed(dataType.child![index], item))
                        } else if (typeof value === 'object' && value !== null) {
                            // For single dictionary entry, take the first key-value pair
                            const entries: [string, unknown][] = Object.entries(value)
                            if (entries.length !== 1) {
                                throw new SignatureError(`Expected object with exactly one key-value pair for dictionary signature "{}", got ${entries.length} pairs`)
                            }
                            const [key, val] = entries[0]
                            this.$value = [DBusSignedValue.typed(dataType.child[0], key), DBusSignedValue.typed(dataType.child[1], val)]
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
                        this.$value = structValues.map((item: any, index: number): DBusSignedValue => DBusSignedValue.typed(dataType.child![index], item))
                        break

                    default:
                        throw new SignatureError(`Unsupported composite type: "${dataType.type}"`)
                }
            } else {
                // Basic type, store value directly without further wrapping
                this.$value = value
            }
        }
        // An empty array is the one value whose complete type cannot be told from its content (a non-empty one
        // takes it from its items), and that type is needed to write the signature of a variant holding it
        if (this.$signature === 'a' && Array.isArray(this.$value) && !this.$value.length && dataTypes[0].child?.length) {
            completeTypes.set(this, dataTypes[0])
        }
    }

    /**
     * The signature a plain value given for a variant ('v') is sent with:
     * - string → 's', boolean → 'b', bigint → 'x'
     * - number → 'i' for an integer within INT32, 'x' for a larger safe integer, 'd' otherwise
     * - Buffer / Uint8Array → 'ay'; other typed arrays → the matching integer array ('an', 'aq', 'ax', 'at')
     * - array → 'a' + the items' type when they share one (numbers widen together, e.g. [1, 1.5] → 'ad'),
     *   otherwise a struct of the items' types, e.g. [1, 'a'] → '(is)'; an empty array → 'ai'
     * - a Map → 'a{' + its keys' type + 'v}', e.g. 'a{iv}' for integer keys
     * - any other object → 'a{sv}', each property value being inferred in turn (a Date, Set or similar is rejected)
     * A value already wrapped in a DBusSignedValue keeps its signature.
     *
     * @example
     * DBusSignedValue.inferSignature({name: 'disk', size: 2 ** 40})   // 'a{sv}' (size is sent as 'x')
     * DBusSignedValue.inferSignature([{id: 1}, {id: 2}])              // 'aa{sv}'
     * DBusSignedValue.inferSignature([1, 'one'])                       // '(is)'
     *
     * @param value - The plain value.
     * @returns The complete signature, e.g. 'as' or '(is)'.
     * @throws {InvalidValueError} For null, undefined, functions and symbols, which have no DBus type.
     */
    public static inferSignature(value: any): string {
        if (value instanceof DBusSignedValue) return DBusSignedValue.completeSignature(value) // type classes included
        switch (typeof value) {
            case 'string':
                return 's'
            case 'boolean':
                return 'b'
            case 'bigint':
                return 'x'
            case 'number':
                return DBusSignedValue.inferNumberType([value])
        }
        if (value === null || typeof value !== 'object') {
            throw new InvalidValueError(`Cannot infer a DBus type for ${value === null ? 'null' : typeof value} in a variant; give the value a type with new DBusSignedValue(signature, value)`)
        }
        if (value instanceof Uint8Array) return 'ay' // Buffer included
        if (value instanceof Int8Array || value instanceof Int16Array) return 'an'
        if (value instanceof Uint16Array) return 'aq'
        if (value instanceof BigInt64Array) return 'ax'
        if (value instanceof BigUint64Array) return 'at'
        if (Array.isArray(value)) {
            if (!value.length) return 'ai'
            if (value.every((item: any): boolean => typeof item === 'number')) return `a${DBusSignedValue.inferNumberType(value)}`
            const itemTypes: string[] = value.map((item: any): string => DBusSignedValue.inferSignature(item))
            if (itemTypes.every((itemType: string): boolean => itemType === itemTypes[0])) return `a${itemTypes[0]}`
            return `(${itemTypes.join('')})`
        }
        if (value instanceof Map) return `a{${DBusSignedValue.inferKeyType([...value.keys()])}v}`
        return 'a{sv}'
    }

    /**
     * The key type of a dictionary given as a Map: 's' for strings (and an empty Map), the narrowest integer or double
     * type for numbers, 'x' for bigints, 'b' for booleans.
     *
     * @throws {InvalidValueError} When the keys are of mixed or non-basic types.
     */
    private static inferKeyType(keys: any[]): string {
        if (keys.every((key: any): boolean => typeof key === 'string')) return 's'
        if (keys.every((key: any): boolean => typeof key === 'number')) return DBusSignedValue.inferNumberType(keys)
        if (keys.every((key: any): boolean => typeof key === 'bigint')) return 'x'
        if (keys.every((key: any): boolean => typeof key === 'boolean')) return 'b'
        throw new InvalidValueError('Cannot infer a DBus type for the keys of a Map in a variant: they must all be strings, numbers, bigints or booleans')
    }

    /**
     * Whether a value is a plain object ({...} or Object.create(null)), as opposed to a Date, Set or class instance.
     */
    private static isPlainObject(value: object): boolean {
        const prototype: object | null = Object.getPrototypeOf(value)
        return prototype === Object.prototype || prototype === null
    }

    /**
     * The narrowest type that holds all the given numbers: 'i' if they are integers within INT32, 'x' if they are
     * safe integers, 'd' otherwise.
     */
    private static inferNumberType(numbers: number[]): string {
        if (numbers.every((num: number): boolean => Number.isInteger(num) && num >= -0x80000000 && num <= 0x7fffffff)) return 'i'
        if (numbers.every((num: number): boolean => Number.isSafeInteger(num))) return 'x'
        return 'd'
    }
}
