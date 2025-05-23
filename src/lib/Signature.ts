import {DataType, Types} from '../types/DataType'
import {SignatureError} from './Errors'

const match: Record<string, string> = {
    '{': '}',
    '(': ')'
}

const knownTypes: Record<string, boolean> = {}
'(){}ybnqiuxtdsogarvehm*?@&^'.split('').forEach(function (c) {
    knownTypes[c] = true
})

export class Signature {

    /**
     * Parse signature string to data type tree
     * @param signature
     */
    public static parseSignature(signature: string): DataType[] {
        let index: number = 0

        function next(): Types {
            if (index < signature.length) {
                const c: string = signature[index]
                ++index
                return c as Types
            }
            return null as any
        }

        function parseOne(c: Types): DataType {
            const parsingType: Types = c

            function checkNotEnd(c: Types) {
                if (!c) throw new SignatureError(`Bad signature: unexpected end (${parsingType})`)
                return c
            }

            if (!knownTypes[c])
                throw new SignatureError(`Unknown type: "${c}" in signature "${signature}"`)

            let ele: Types
            const res: DataType = {type: c, child: []}
            switch (c) {
                case 'a': // array
                    ele = next()
                    checkNotEnd(ele)
                    res.child!.push(parseOne(ele))
                    return res
                case '{': // dict entry
                case '(': // struct
                    while ((ele = next()) !== null && ele !== match[c])
                        res.child!.push(parseOne(ele))
                    checkNotEnd(ele)
                    return res
            }
            return res
        }

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
     * @param baseSignature The base signature string (reference, e.g., method definition "vs"). Can be undefined.
     * @param inputSignature The input signature string to compare (e.g., method call "a{sv}s"). Can be undefined.
     * @returns True if the signatures are compatible, false if they are not or if inputs are invalid.
     * @throws {SignatureError} If either signature is invalid (non-empty and cannot be parsed).
     */
    public static areSignaturesCompatible(baseSignature: string | undefined, inputSignature: string | undefined): boolean {
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
            return false
        }

        // Step 4: Recursively compare each DataType pair
        const compareDataTypes = (baseDt: DataType, inputDt: DataType): boolean => {
            // If base type is 'v' (variant), accept any input type as compatible at this position
            if (baseDt.type === 'v') {
                return true // Variant accepts any type
            }

            // Otherwise, check if types match
            if (baseDt.type !== inputDt.type) {
                return false
            }

            // If the type has children (like array, struct, dict), compare them recursively
            if (baseDt.child && inputDt.child) {
                if (baseDt.child.length !== inputDt.child.length) {
                    return false
                }
                for (let i = 0; i < baseDt.child.length; i++) {
                    if (!compareDataTypes(baseDt.child[i], inputDt.child[i])) {
                        return false
                    }
                }
            }
            return true
        }

        // Step 5: Compare all top-level types
        for (let i = 0; i < baseDataTypes.length; i++) {
            if (!compareDataTypes(baseDataTypes[i], inputDataTypes[i])) {
                return false
            }
        }

        // All checks passed, signatures are compatible
        return true
    }
}