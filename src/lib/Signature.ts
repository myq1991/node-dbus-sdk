import {DataType, Types} from '../types/DataType'
import {SignatureError} from './Errors'

/**
 * A mapping of opening brackets to their corresponding closing brackets.
 * Used to validate and parse nested structures like dictionaries and structs in DBus signatures.
 */
const match: Record<string, string> = {
    '{': '}',
    '(': ')'
}

/**
 * A mapping of known DBus signature type characters to a boolean flag.
 * Used to validate whether a character represents a valid DBus type during signature parsing.
 */
const knownTypes: Record<string, boolean> = {}
'(){}ybnqiuxtdsogarvehm*?@&^'.split('').forEach(function (c) {
    knownTypes[c] = true
})

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
        let index: number = 0

        /**
         * Advances the index and returns the next character from the signature string as a Types enum value.
         * Returns null if the end of the string is reached.
         *
         * @returns The next character as a Types value, or null if at the end of the signature.
         */
        function next(): Types {
            if (index < signature.length) {
                const c: string = signature[index]
                ++index
                return c as Types
            }
            return null as any
        }

        /**
         * Parses a single type character into a DataType object, handling nested structures recursively.
         * Validates the type and processes nested children for arrays, structs, and dictionary entries.
         *
         * @param c - The current type character (as a Types enum value) to parse.
         * @returns A DataType object representing the parsed type and its children (if any).
         * @throws {SignatureError} If the signature is malformed or ends unexpectedly.
         */
        function parseOne(c: Types): DataType {
            const parsingType: Types = c

            /**
             * Checks if the current character exists (i.e., not null) and throws an error if the signature ends unexpectedly.
             *
             * @param c - The character to check.
             * @returns The same character if it exists.
             * @throws {SignatureError} If the character is null (unexpected end of signature).
             */
            function checkNotEnd(c: Types) {
                if (!c) throw new SignatureError(`Bad signature: unexpected end (${parsingType})`)
                return c
            }

            // Validate that the type character is a known DBus type
            if (!knownTypes[c])
                throw new SignatureError(`Unknown type: "${c}" in signature "${signature}"`)

            let ele: Types
            const res: DataType = {type: c, child: []}
            switch (c) {
                case 'a': // Array type - must be followed by the element type
                    ele = next()
                    checkNotEnd(ele)
                    res.child!.push(parseOne(ele))
                    return res
                case '{': // Dictionary entry - key-value pair, must be closed with '}'
                case '(': // Struct - ordered list of types, must be closed with ')'
                    while ((ele = next()) !== null && ele !== match[c])
                        res.child!.push(parseOne(ele))
                    checkNotEnd(ele)
                    return res
            }
            // For basic types (e.g., 's', 'i'), no children are added
            return res
        }

        // Parse the entire signature string into an array of top-level DataType objects
        const ret: DataType[] = []
        let c: Types
        while ((c = next()) !== null) ret.push(parseOne(c))
        return ret
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
}
