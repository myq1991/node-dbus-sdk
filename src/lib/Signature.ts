import {DataType, Types} from '../types/DataType'
import {SignatureError} from './Errors'

/**
 * Type codes of the basic types, which are the only types allowed as dictionary keys.
 */
const BASIC_TYPES: string = 'ybnqiuxtdsogh'

/**
 * Limits from the DBus specification.
 */
const MAX_SIGNATURE_LENGTH: number = 255
const MAX_ARRAY_DEPTH: number = 32
const MAX_STRUCT_DEPTH: number = 32

/**
 * Class for handling DBus signature parsing and compatibility checking.
 * Provides static methods to parse signature strings into data type trees and compare signatures for compatibility.
 */
export class Signature {

    /**
     * Parses a DBus signature string into an array of data type structures.
     * Converts a signature string (e.g., 'a{sv}') into a tree-like structure of DataType objects.
     * Throws a SignatureError if the signature is invalid or contains unknown types.
     *
     * @param signature - The DBus signature string to parse (e.g., 'a{sv}' for an array of dictionary entries).
     * @returns An array of DataType objects representing the parsed signature structure.
     * @throws {SignatureError} If the signature is invalid or contains unrecognized types.
     */
    public static parseSignature(signature: string): DataType[] {
        if (typeof signature !== 'string') throw new SignatureError(`A signature must be a string, got ${typeof signature}`)
        if (signature.length > MAX_SIGNATURE_LENGTH) throw new SignatureError(`Signature longer than ${MAX_SIGNATURE_LENGTH} characters: "${signature}"`)
        let index: number = 0

        const fail = (reason: string): never => {
            throw new SignatureError(`Bad signature "${signature}": ${reason}`)
        }

        /**
         * Parses one complete type starting at the current position.
         *
         * @param arrayDepth - Arrays enclosing this type.
         * @param structDepth - Structs and dict entries enclosing this type (they share one limit).
         * @param inArray - Whether this type is the element type of an array, the only place a dict entry may appear.
         */
        const parseOne = (arrayDepth: number, structDepth: number, inArray: boolean): DataType => {
            if (index >= signature.length) fail('unexpected end')
            const c: string = signature[index++]
            switch (c) {
                case 'a':
                    if (arrayDepth >= MAX_ARRAY_DEPTH) fail(`arrays nested deeper than ${MAX_ARRAY_DEPTH}`)
                    if (index >= signature.length) fail('array without element type')
                    return {type: 'a', child: [parseOne(arrayDepth + 1, structDepth, true)]}
                case '(': {
                    if (structDepth >= MAX_STRUCT_DEPTH) fail(`structs nested deeper than ${MAX_STRUCT_DEPTH}`)
                    const fields: DataType[] = []
                    while (index < signature.length && signature[index] !== ')') fields.push(parseOne(arrayDepth, structDepth + 1, false))
                    if (index >= signature.length) fail('struct not closed')
                    index++
                    if (!fields.length) fail('empty struct')
                    return {type: '(', child: fields}
                }
                case '{': {
                    if (!inArray) fail('dict entry outside an array')
                    if (structDepth >= MAX_STRUCT_DEPTH) fail(`structs nested deeper than ${MAX_STRUCT_DEPTH}`)
                    const entry: DataType[] = []
                    while (index < signature.length && signature[index] !== '}') entry.push(parseOne(arrayDepth, structDepth + 1, false))
                    if (index >= signature.length) fail('dict entry not closed')
                    index++
                    if (entry.length !== 2) fail(`dict entry with ${entry.length} types instead of a key and a value`)
                    if (!BASIC_TYPES.includes(entry[0].type)) fail(`dict entry key of type "${entry[0].type}" (keys must be basic types)`)
                    return {type: '{', child: entry}
                }
                case ')':
                case '}':
                    return fail(`unexpected "${c}"`)
                default:
                    if (c === 'v' || BASIC_TYPES.includes(c)) return {type: c as Types, child: []}
                    return fail(`unknown type code "${c}"`)
            }
        }

        // Parse the entire signature string into an array of top-level DataType objects
        const types: DataType[] = []
        while (index < signature.length) types.push(parseOne(0, 0, false))
        return types
    }

    /**
     * Compare two signature strings to check if they are compatible.
     * The base signature is the reference (e.g., method definition), and the input signature is the one to compare (e.g., method call).
     * If the base signature contains 'v' (variant), any type in the input signature at that position is considered compatible.
     * This rule applies recursively to nested structures.
     * Returns false instead of throwing an error if signatures are incompatible.
     * Handles cases where signatures are undefined or empty.
     *
     * @param baseSignature - The base signature string (reference, e.g., method definition "vs"). Can be undefined.
     * @param inputSignature - The input signature string to compare (e.g., method call "a{sv}s"). Can be undefined.
     * @returns True if the signatures are compatible, false if they are not or if inputs are invalid.
     * @throws {SignatureError} If either signature is invalid (non-empty and cannot be parsed).
     */
    public static areSignaturesCompatible(baseSignature: string | undefined, inputSignature: string | undefined): boolean {
        // Normalize undefined signatures to empty strings for consistent handling
        baseSignature = baseSignature ? baseSignature : ''
        inputSignature = inputSignature ? inputSignature : ''

        // Step 1: Handle undefined cases
        if (baseSignature === undefined && inputSignature === undefined) {
            return true // Both undefined, consider compatible (no signature to compare)
        }
        if (baseSignature === undefined || inputSignature === undefined) {
            return false // One is undefined while the other is not, consider incompatible
        }

        // Step 2: Parse both signatures into DataType arrays
        // Empty strings are handled by parseSignature and result in empty arrays
        const baseDataTypes = Signature.parseSignature(baseSignature)
        const inputDataTypes = Signature.parseSignature(inputSignature)

        // Step 3: Compare the parsed structures for top-level length
        if (baseDataTypes.length !== inputDataTypes.length) {
            return false // Different number of top-level types means incompatibility
        }

        /**
         * Recursively compares two DataType objects to check if they are compatible.
         * Handles special case for 'v' (variant) in base signature, which accepts any type.
         *
         * @param baseDt - The base DataType to compare against.
         * @param inputDt - The input DataType to check for compatibility.
         * @returns True if the types are compatible, false otherwise.
         */
        const compareDataTypes = (baseDt: DataType, inputDt: DataType): boolean => {
            // If base type is 'v' (variant), accept any input type as compatible at this position
            if (baseDt.type === 'v') {
                return true // Variant accepts any type
            }

            // Otherwise, check if types match
            if (baseDt.type !== inputDt.type) {
                return false // Types differ, not compatible
            }

            // If the type has children (like array, struct, dict), compare them recursively
            if (baseDt.child && inputDt.child) {
                if (baseDt.child.length !== inputDt.child.length) {
                    return false // Different number of child types, not compatible
                }
                for (let i = 0; i < baseDt.child.length; i++) {
                    if (!compareDataTypes(baseDt.child[i], inputDt.child[i])) {
                        return false // A child type is incompatible
                    }
                }
            }
            return true // All checks passed for this type
        }

        // Step 5: Compare all top-level types
        for (let i = 0; i < baseDataTypes.length; i++) {
            if (!compareDataTypes(baseDataTypes[i], inputDataTypes[i])) {
                return false // A top-level type is incompatible
            }
        }

        // All checks passed, signatures are compatible
        return true
    }

    /**
     * Converts a parsed type back into its signature string, e.g. {type: 'a', child: [{type: 's'}]} into 'as'.
     *
     * @param dataType - A complete type (see isComplete).
     * @returns The signature of the type.
     */
    public static stringify(dataType: DataType): string {
        const children: string = (dataType.child || []).map((child: DataType): string => Signature.stringify(child)).join('')
        switch (dataType.type) {
            case '(':
                return `(${children})`
            case '{':
                return `{${children}}`
            default:
                return `${dataType.type}${children}`
        }
    }

    /**
     * Whether a parsed type carries its full structure: every container lists its child types
     * (one for arrays, two for dict entries, at least one for structs).
     *
     * @param dataType - The type to check.
     * @returns True if stringify() reproduces the full signature.
     */
    public static isComplete(dataType: DataType): boolean {
        const children: DataType[] = dataType.child || []
        switch (dataType.type) {
            case 'a':
                return children.length === 1 && Signature.isComplete(children[0])
            case '{':
                return children.length === 2 && children.every(Signature.isComplete)
            case '(':
                return children.length > 0 && children.every(Signature.isComplete)
            default:
                return children.length === 0
        }
    }
}
