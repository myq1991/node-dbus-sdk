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
}