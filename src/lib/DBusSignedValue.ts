import {Signature} from './Signature'
import {DataType} from '../types/DataType'
import {InvalidValueError, SignatureError} from './Errors'
import {DEFAULT_DECODE, ResolvedDecodeOpts} from './resolveDecode'
import {fitsInteger, INTEGER_RANGES} from './integerRanges'

/**
 * The complete type of empty arrays. Values only expose the first character of their type ($signature), and an
 * empty array has no items to tell the rest, which is needed to write the signature of a variant holding it
 * (e.g. an empty 'a{sv}'). Kept outside the objects so their visible shape does not change; recorded for empty
 * arrays only, because every other value's type can be rebuilt from its content.
 */
const completeTypes: WeakMap<DBusSignedValue, DataType> = new WeakMap()

/**
 * Where a plain container's members came from, for those holding variants: the decoded values they were converted
 * from, read only if the container is sent again (decoding stays cheap), or signatures by member.
 */
type VariantSource =
    { kind: 'decoded', items: DBusSignedValue[], dictionary: boolean, mapKeys: boolean, opts: ResolvedDecodeOpts, byKey?: Map<any, DBusSignedValue> }
    | { kind: 'signatures', signatures: Map<any, string> }

/**
 * The original types of values that arrived in variants, kept for the plain container holding them (object, Map or
 * array): when such a container is sent again, a member still fitting its type goes out with it instead of the type
 * its plain value would be inferred as (e.g. 'u' instead of 'i'). Outside the objects, so they print, compare and
 * serialize as before. Newest sources first: a container merged from several (see copyVariantTypes) has several.
 */
const variantTypes: WeakMap<object, VariantSource[]> = new WeakMap()

/**
 * Beyond this many sources, a container's sources are merged into one signature table.
 */
const MAX_VARIANT_SOURCES: number = 16

const OBJECT_PATH: RegExp = /^\/$|^(\/[A-Za-z0-9_]+)+$/

/**
 * A value with an explicit DBus type: use it wherever a value is sent to give it a type other than the one it would
 * get otherwise, typically inside variants (`v`) and `a{sv}` dictionaries. Containers may hold plain values, which
 * take their types from the signature, and typed values, which keep theirs. The type classes (DBusUInt32,
 * DBusObjectPath, DBusArray, …) are DBusSignedValue too.
 *
 * Received values come back as type class instances where DecodeOpts.types asks for them.
 *
 * @example
 * new DBusSignedValue('u', 7)                                            // the same as new DBusUInt32(7)
 * new DBusSignedValue('a{sv}', {mtu: new DBusUInt32(1500), name: 'eth0'})
 * new DBusSignedValue('as', [])                                          // an empty array of strings
 * new DBusSignedValue('(uu)', [1, 2])
 */
export class DBusSignedValue {
    /**
     * @internal
     * The type code of the value (e.g. 'a' for any array); its complete type is `signature`.
     */
    public readonly $signature: string

    /**
     * @internal
     * The type code of the elements of an array.
     */
    public $arrayItemSignature?: string

    /**
     * @internal
     * The value in the form the encoder writes: a primitive, a Buffer for bytes, the contained DBusSignedValue for a
     * variant, or the DBusSignedValue children of a container.
     */
    public readonly $value: any | DBusSignedValue | DBusSignedValue[]

    /**
     * The complete signature of this value, e.g. 'u', 'as' or 'a{sv}'.
     */
    public get signature(): string {
        return DBusSignedValue.completeSignature(this)
    }

    /**
     * This value as a plain JavaScript value, the way it is decoded by default: numbers, bigints for 64-bit
     * integers, strings, booleans, Buffers for byte arrays, arrays, and objects for dictionaries.
     */
    public get value(): any {
        return DBusSignedValue.convert([this], DEFAULT_DECODE)[0]
    }

    /**
     * @internal
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
            return dataTypes.map((dataType: DataType, index: number): DBusSignedValue => DBusSignedValue.typedIn(values, index, dataType, values[index]))
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
        return DBusSignedValue.convert(values, DEFAULT_DECODE)
    }

    /**
     * @internal
     * Converts values, as decoded, into what DecodeOpts asks for. With types 'none', the original signatures of
     * values that came in variants are recorded on the plain containers holding them (see variantTypes).
     *
     * @param values - The values.
     * @param opts - The decoding choices.
     * @param toTypeClass - Converts a value into its type class instance; needed for types other than 'none'
     *                      (passed in because the type classes extend this class).
     * @returns The converted values.
     */
    public static convert(values: DBusSignedValue[], opts: ResolvedDecodeOpts, toTypeClass?: (value: DBusSignedValue) => DBusSignedValue): any[] {
        if (opts.types === 'all') return values.map((value: DBusSignedValue): DBusSignedValue => toTypeClass!(value))
        const converted: any[] = values.map((value: DBusSignedValue): any => DBusSignedValue.convertValue(value, opts, toTypeClass))
        if (values.some((value: DBusSignedValue): boolean => value.$signature === 'v')) DBusSignedValue.noteVariants(converted, values, false, opts)
        return converted
    }

    /**
     * @internal
     * Copies the recorded variant signatures of one plain container onto another, e.g. when a copy of received
     * properties is kept; existing records of the target are kept unless the source has the same member.
     *
     * @param source - The container the values were received in.
     * @param target - The copy.
     */
    public static copyVariantTypes(source: object, target: object): void {
        const recorded: VariantSource[] | undefined = variantTypes.get(source)
        if (!recorded) return
        const sources: VariantSource[] = [...recorded, ...(variantTypes.get(target) ?? [])]
        variantTypes.set(target, sources.length > MAX_VARIANT_SOURCES ? [DBusSignedValue.mergeSources(sources)] : sources)
    }

    /**
     * Merges sources (newest first) into one signature table.
     */
    private static mergeSources(sources: VariantSource[]): VariantSource {
        const signatures: Map<any, string> = new Map()
        for (const source of [...sources].reverse()) {
            if (source.kind === 'signatures') {
                source.signatures.forEach((signature: string, key: any): Map<any, string> => signatures.set(key, signature))
                continue
            }
            const slots: [any, DBusSignedValue][] = source.dictionary ? [...DBusSignedValue.slotsByKey(source).entries()] : source.items.map((item: DBusSignedValue, index: number): [any, DBusSignedValue] => [index, item])
            for (const [key, slot] of slots) {
                const signature: string | undefined = DBusSignedValue.variantSignature(slot)
                if (signature) signatures.set(key, signature)
            }
        }
        return {kind: 'signatures', signatures}
    }

    /**
     * The decoded value of each member of a dictionary source, by the key the plain container has for it.
     */
    private static slotsByKey(source: Extract<VariantSource, { kind: 'decoded' }>): Map<any, DBusSignedValue> {
        if (!source.byKey) {
            source.byKey = new Map()
            for (const entry of source.items) {
                const [key, entryValue] = entry.$value as DBusSignedValue[]
                const plainKey: any = DBusSignedValue.convertValue(key, source.opts)
                source.byKey.set(source.mapKeys ? plainKey : String(plainKey), entryValue)
            }
        }
        return source.byKey
    }

    /**
     * The recorded signature of a variant value as received ('v:' prefixes for variants holding variants), or
     * undefined if the value was not a variant.
     */
    private static variantSignature(slot: DBusSignedValue | undefined): string | undefined {
        if (!slot || slot.$signature !== 'v') return undefined
        let content: DBusSignedValue = slot.$value as DBusSignedValue
        let levels: string = ''
        while (content.$signature === 'v') {
            levels += 'v:'
            content = content.$value as DBusSignedValue
        }
        return levels + DBusSignedValue.completeSignature(content)
    }

    /**
     * The signature a member of a plain container was received with in a variant, if recorded.
     */
    private static recordedSignature(container: object, key: any): string | undefined {
        const sources: VariantSource[] | undefined = variantTypes.get(container)
        if (!sources) return undefined
        for (const source of sources) {
            const signature: string | undefined = source.kind === 'signatures'
                ? source.signatures.get(key)
                : DBusSignedValue.variantSignature(source.dictionary ? DBusSignedValue.slotsByKey(source).get(key) : source.items[key])
            if (signature) return signature
        }
        return undefined
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
                // Each element's signature is computed once: computing it again per check doubles the work at every level
                // of nesting
                const elementSignatures: string[] = values.map((val: DBusSignedValue): string => DBusSignedValue.completeSignature(val))
                const firstElementSignature: string = elementSignatures[0]
                const isConsistent: boolean = elementSignatures.every((signature: string): boolean => signature === firstElementSignature)
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
     * @internal
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
     * @internal
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
     * @internal
     * Like typed, for a member of a plain container: a plain value for a variant slot whose container recorded the
     * signature it was received with (see variantTypes) goes out with that signature, if the value still fits it.
     *
     * @param container - The plain object, Map or array holding the item.
     * @param key - The item's property name, Map key or index.
     * @param dataType - The type of the slot.
     * @param item - The item.
     * @returns The value for the slot.
     */
    protected static typedIn(container: object, key: any, dataType: DataType, item: any): DBusSignedValue {
        if (dataType.type === 'v' && !(item instanceof DBusSignedValue)) {
            const recorded: DBusSignedValue | undefined = DBusSignedValue.recorded(DBusSignedValue.recordedSignature(container, key), item)
            if (recorded) return new DBusSignedValue('v', recorded)
        }
        return DBusSignedValue.typed(dataType, item)
    }

    /**
     * The value a variant held when received, rebuilt with its recorded signature ('v:' prefixes for variants
     * holding variants), if the plain value still fits it.
     */
    private static recorded(signature: string | undefined, item: any): DBusSignedValue | undefined {
        if (!signature) return undefined
        let levels: number = 0
        while (signature.startsWith('v:', levels * 2)) levels++
        const contentSignature: string = signature.substring(levels * 2)
        if (!DBusSignedValue.fits(contentSignature, item)) return undefined
        let value: DBusSignedValue = new DBusSignedValue(contentSignature, item)
        for (let level: number = 0; level < levels; level++) value = new DBusSignedValue('v', value)
        return value
    }

    /**
     * @internal
     * The value to encode for a message body: the arguments, or the only one, which then keeps the signature it was
     * received with if it came in a variant and the arguments list recorded it.
     *
     * @param signature - The body's signature.
     * @param args - The arguments.
     * @returns What to give the encoder for the signature.
     */
    public static bodyValue(signature: string, args: any[]): any {
        if (args.length !== 1) return args
        if (signature === 'v' && !(args[0] instanceof DBusSignedValue)) {
            const recorded: DBusSignedValue | undefined = DBusSignedValue.recorded(DBusSignedValue.recordedSignature(args, 0), args[0])
            // The recorded value is the variant's content: the variant itself wraps it
            if (recorded) return new DBusSignedValue('v', recorded)
        }
        return args[0]
    }

    /**
     * Whether a plain value can be sent with a signature: integers within range, numbers for doubles, booleans,
     * strings (valid paths for object paths), and the matching kind of container. The content of containers is
     * checked when they are encoded.
     */
    private static fits(signature: string, value: any): boolean {
        const code: string = signature[0]
        if (code in INTEGER_RANGES) return fitsInteger(code, value)
        switch (code) {
            case 'd':
                return typeof value === 'number'
            case 'b':
                return typeof value === 'boolean' || value === 0 || value === 1
            case 's':
            case 'g':
                return typeof value === 'string'
            case 'o':
                return typeof value === 'string' && OBJECT_PATH.test(value)
            case 'v':
                return value !== undefined && value !== null
            case '(':
                return Array.isArray(value)
            case 'a':
                if (signature[1] === 'y') return value instanceof Uint8Array || Array.isArray(value)
                if (signature[1] === '{') return value instanceof Map || Array.isArray(value) || (typeof value === 'object' && value !== null && DBusSignedValue.isPlainObject(value))
                return Array.isArray(value) || ArrayBuffer.isView(value)
            default:
                return false
        }
    }

    /**
     * Remembers, with types 'none', which decoded values a plain container holding variants was converted from (with
     * other choices the converted values carry their types themselves). Nothing is computed until the container is
     * sent again.
     */
    private static noteVariants(container: object, items: DBusSignedValue[], dictionary: boolean, opts: ResolvedDecodeOpts): void {
        if (opts.types !== 'none') return
        variantTypes.set(container, [{kind: 'decoded', items, dictionary, mapKeys: container instanceof Map, opts}])
    }

    /**
     * Converts one value as DecodeOpts asks (see convert), recursively.
     */
    private static convertValue(value: DBusSignedValue, opts: ResolvedDecodeOpts, toTypeClass?: (value: DBusSignedValue) => DBusSignedValue): any {
        switch (value.$signature) {
            case 'a': {
                if (Buffer.isBuffer(value.$value)) return value.$value
                const items: DBusSignedValue[] = value.$value as DBusSignedValue[]
                const itemSignature: string | undefined = value.$arrayItemSignature || items[0]?.$signature
                if (itemSignature === '{') {
                    // An array of dictionary entries is a dictionary: one object (or Map) with every entry
                    const asMap: boolean = opts.dictionaries === 'map'
                    const dictionary: any = asMap ? new Map() : {}
                    for (const entry of items) {
                        const [key, entryValue] = entry.$value as DBusSignedValue[]
                        const plainKey: any = DBusSignedValue.convertValue(key, opts, toTypeClass)
                        const plainValue: any = DBusSignedValue.convertValue(entryValue, opts, toTypeClass)
                        if (asMap) {
                            dictionary.set(plainKey, plainValue)
                        } else {
                            dictionary[plainKey] = plainValue
                        }
                    }
                    // Entries share one type, so the first tells whether the values are variants
                    if ((items[0]?.$value as DBusSignedValue[] | undefined)?.[1].$signature === 'v') DBusSignedValue.noteVariants(dictionary, items, true, opts)
                    return dictionary
                }
                if (itemSignature === 'y') {
                    const bytes: Buffer = Buffer.allocUnsafe(items.length)
                    for (let i: number = 0; i < items.length; i++) bytes[i] = items[i].$value
                    return bytes
                }
                const array: any[] = items.map((item: DBusSignedValue): any => DBusSignedValue.convertValue(item, opts, toTypeClass))
                if (itemSignature === 'v') DBusSignedValue.noteVariants(array, items, false, opts)
                return array
            }
            case '{': { // A single dictionary entry outside an array
                const [key, entryValue] = value.$value as DBusSignedValue[]
                return {[DBusSignedValue.convertValue(key, opts, toTypeClass)]: DBusSignedValue.convertValue(entryValue, opts, toTypeClass)}
            }
            case '(': {
                const fields: DBusSignedValue[] = value.$value as DBusSignedValue[]
                const struct: any[] = fields.map((field: DBusSignedValue): any => DBusSignedValue.convertValue(field, opts, toTypeClass))
                if (fields.some((field: DBusSignedValue): boolean => field.$signature === 'v')) DBusSignedValue.noteVariants(struct, fields, false, opts)
                return struct
            }
            case 'v':
                if (opts.types === 'variants' && toTypeClass) {
                    // A DBusVariant placed where a variant goes is that variant itself, so a variant holding a variant
                    // is given whole: its content alone would lose one level when sent back
                    const content: DBusSignedValue = value.$value as DBusSignedValue
                    return toTypeClass(content.$signature === 'v' ? value : content)
                }
                return DBusSignedValue.convertValue(value.$value as DBusSignedValue, opts, toTypeClass)
            case 'x':
            case 't':
                // Only safe integers become numbers, so that no value is ever changed
                if (opts.int64 === 'number' && typeof value.$value === 'bigint' && value.$value >= BigInt(Number.MIN_SAFE_INTEGER) && value.$value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value.$value)
                return value.$value
            default:
                return value.$value instanceof DBusSignedValue ? DBusSignedValue.convertValue(value.$value, opts, toTypeClass) : value.$value
        }
    }

    /**
     * Gives a value a DBus type.
     *
     * @param signature - The complete signature of one type, e.g. 'u', 'as', 'a{sv}' or '(si)'.
     * @param value - The value: plain values take their types from the signature, DBusSignedValue values (and type
     *                class instances) inside containers keep theirs. A variant ('v') holds a typed value, or a plain
     *                one whose type is inferred (see inferSignature).
     * @throws {SignatureError} If the signature is invalid or the value's shape does not match it (e.g. a string for
     *         an array). Values out of range for their type are rejected when encoded.
     */
    constructor(signature: string, value: any)
    /**
     * @internal
     * Also accepts parsed types, as the library builds values.
     *
     * @param signature - A signature string, a parsed type, or a list of parsed types (taken as a struct).
     * @param value - The value.
     */
    constructor(signature: string | DataType | DataType[], value: any)
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
            const container: object = value
            this.$value = structValues.map((item: any, index: number): DBusSignedValue => DBusSignedValue.typedIn(container, index, dataTypes[index], item))
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
                                        const valObj: DBusSignedValue = DBusSignedValue.typedIn(value, key, valueDataType, val)
                                        // Create a DBusSignedValue for a single dictionary entry {...}
                                        return new DBusSignedValue(dataType.child![0], [keyObj, valObj])
                                    })
                                }
                                break
                            }
                            throw new SignatureError(`Expected array for signature "a", got: ${typeof value}. Non-dictionary array types do not support object input except for Buffer with ay.`)
                        }
                        // Handle Array or TypedArray for array type
                        this.$value = Array.from(value).map((item: any, index: number): DBusSignedValue => DBusSignedValue.typedIn(value, index, dataType.child![0], item))
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
                        this.$value = structValues.map((item: any, index: number): DBusSignedValue => DBusSignedValue.typedIn(value, index, dataType.child![index], item))
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
