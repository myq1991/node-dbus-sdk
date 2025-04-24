import {IType, Types} from '../types/IType'

const match: Record<string, string> = {
    '{': '}',
    '(': ')'
}

const knownTypes: Record<string, boolean> = {}
'(){}ybnqiuxtdsogarvehm*?@&^'.split('').forEach(function (c) {
    knownTypes[c] = true
})

export class Signature {

    public static parseSignature(signature: string): IType[] {
        let index: number = 0

        function next(): Types {
            if (index < signature.length) {
                let c: string = signature[index]
                ++index
                return c as Types
            }
            return null as any
        }

        function parseOne(c: Types): IType {
            function checkNotEnd(c: Types) {
                if (!c) throw new Error('Bad signature: unexpected end')
                return c
            }

            if (!knownTypes[c])
                throw new Error(`Unknown type: "${c}" in signature "${signature}"`)

            let ele: Types
            let res: IType = {type: c, child: []}
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

        let ret: IType[] = []
        let c: Types
        while ((c = next()) !== null) ret.push(parseOne(c))
        return ret
    }

    public static fromTree(tree: IType[]): string {
        let res: string = ''
        for (let i: number = 0; i < tree.length; ++i) {
            if (tree[i].child!.length === 0) {
                res += tree[i].type
            } else {
                if (tree[i].type === 'a') {
                    res += `a${this.fromTree(tree[i].child!)}`
                } else {
                    res += tree[i].type + this.fromTree(tree[i].child!) + match[tree[i].type]
                }
            }
        }
        return res
    }
}