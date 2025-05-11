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
                let c: string = signature[index]
                ++index
                return c as Types
            }
            return null as any
        }

        function parseOne(c: Types): DataType {
            function checkNotEnd(c: Types) {
                if (!c) throw new SignatureError('Bad signature: unexpected end')
                return c
            }

            if (!knownTypes[c])
                throw new SignatureError(`Unknown type: "${c}" in signature "${signature}"`)

            let ele: Types
            let res: DataType = {type: c, child: []}
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

        let ret: DataType[] = []
        let c: Types
        while ((c = next()) !== null) ret.push(parseOne(c))
        return ret
    }

    /**
     * Data type tree to signature string
     * @param tree
     */
    public static fromTree(tree: DataType[]): string {
        let signature: string = ''
        for (let i: number = 0; i < tree.length; ++i) {
            if (tree[i].child!.length === 0) {
                signature += tree[i].type
            } else {
                if (tree[i].type === 'a') {
                    signature += `a${this.fromTree(tree[i].child!)}`
                } else {
                    signature += tree[i].type + this.fromTree(tree[i].child!) + match[tree[i].type]
                }
            }
        }
        return signature
    }
}