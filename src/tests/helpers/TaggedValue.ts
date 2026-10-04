import {readFileSync} from 'node:fs'
import path from 'node:path'
import {DBusSignedValue} from '../../lib/DBusSignedValue'

/**
 * A value from wire-matrix.json in the tagged JSON form written by src/tests/fixtures/gdbus/generate.py.
 */
export type TaggedValue = any

export interface MatrixCase {
    id: string
    category: string
    signature: string
    args: TaggedValue[]
    le: string
    be: string
    texts: string[]
    replyText: string
}

export interface WireMatrix {
    generator: string
    echoMethods: Record<string, string>
    cases: MatrixCase[]
}

/**
 * Loads the GDBus-generated reference vectors from the source tree (tests run from build/).
 */
export function loadWireMatrix(): WireMatrix {
    const file: string = path.resolve(__dirname, '../../../src/tests/fixtures/gdbus/wire-matrix.json')
    return JSON.parse(readFileSync(file, 'utf8'))
}

function isTag(value: TaggedValue, tag: string): boolean {
    return value !== null && typeof value === 'object' && !Array.isArray(value) && tag in value
}

function toDouble(text: string): number {
    switch (text) {
        case 'NaN':
            return NaN
        case 'Infinity':
            return Infinity
        case '-Infinity':
            return -Infinity
        default:
            return -0
    }
}

/**
 * The property name a decoded dictionary key ends up under in a plain JavaScript object.
 */
function keyString(key: any): string {
    return typeof key === 'bigint' ? key.toString() : String(key)
}

export interface InputForm {
    /**
     * Give every variant as a plain value for the library to infer its type.
     */
    plain?: boolean
    /**
     * Give dictionaries as arrays of [key, value] pairs even when their keys are strings.
     */
    pairs?: boolean
    /**
     * Give variants as `DBusSignedValue('v', DBusSignedValue(innerType, value))` instead of `DBusSignedValue(innerType, value)`.
     */
    explicitVariants?: boolean
}

/**
 * Converts a tagged value into what a library user passes to the encoder.
 * By default explicitly typed variants become `DBusSignedValue(innerType, value)` (the library wraps them in the variant),
 * inside an inferred variant everything is a plain value, and dictionaries with string keys are objects while other
 * dictionaries are arrays of [key, value] pairs.
 *
 * @param value - Tagged value.
 * @param form - Which of the accepted input forms to produce.
 * @returns The library input.
 */
export function toInput(value: TaggedValue, form: InputForm = {}): any {
    if (Array.isArray(value)) return value.map((item: TaggedValue): any => toInput(item, form))
    if (isTag(value, '$bigint')) return BigInt(value.$bigint)
    if (isTag(value, '$double')) return toDouble(value.$double)
    if (isTag(value, '$bytes')) return Buffer.from(value.$bytes, 'hex')
    if (isTag(value, '$struct')) return toInput(value.$struct, form)
    if (isTag(value, '$infer')) return toInput(value.$infer.value, {...form, plain: true})
    if (isTag(value, '$variant')) {
        const inner: any = toInput(value.$variant.value, form)
        if (form.plain) return inner
        const signature: string = value.$variant.signature
        // DBusSignedValue('v', x) means "a variant holding x", for every other type it means "x as that type"
        const typed: DBusSignedValue = signature !== 'v'
            ? new DBusSignedValue(signature, inner)
            : inner instanceof DBusSignedValue && inner.$signature === 'v' ? inner : new DBusSignedValue('v', inner)
        // The library wraps a value of the inner type in the variant itself, but takes a value whose own type is 'v'
        // as the variant, so a variant holding a variant (and the explicit form) needs the wrapper spelled out
        return form.explicitVariants || signature === 'v' ? new DBusSignedValue('v', typed) : typed
    }
    if (isTag(value, '$dict')) {
        const entries: [any, any][] = value.$dict.map(([key, item]: [TaggedValue, TaggedValue]): [any, any] => [toInput(key, form), toInput(item, form)])
        if (form.plain || (!form.pairs && entries.every(([key]): boolean => typeof key === 'string'))) {
            const object: Record<string, any> = {}
            entries.forEach(([key, item]): any => object[keyString(key)] = item)
            return object
        }
        return entries
    }
    return value
}

/**
 * Lists the input forms that differ from the default for a case, so each accepted way of passing values is encoded.
 *
 * @param args - The case's tagged arguments.
 * @returns Names and forms of the additional inputs to test.
 */
export function alternativeInputForms(args: TaggedValue[]): [string, InputForm][] {
    const json: string = JSON.stringify(args)
    const forms: [string, InputForm][] = []
    if (/"\$dict":\[\["/.test(json)) forms.push(['dictionaries as [key, value] pairs', {pairs: true}])
    if (json.includes('"$variant"')) forms.push(['variants as DBusSignedValue(\'v\', ...)', {explicitVariants: true}])
    return forms
}

/**
 * Converts a tagged value into the plain JavaScript value the decoder should produce:
 * 64-bit integers as bigint, byte arrays as Buffer, dictionaries as objects, structs as arrays,
 * and variants as their contained value.
 *
 * @param value - Tagged value.
 * @returns The expected decoded value.
 */
export function toExpected(value: TaggedValue): any {
    if (Array.isArray(value)) return value.map(toExpected)
    if (isTag(value, '$bigint')) return BigInt(value.$bigint)
    if (isTag(value, '$double')) return toDouble(value.$double)
    if (isTag(value, '$bytes')) return Buffer.from(value.$bytes, 'hex')
    if (isTag(value, '$struct')) return toExpected(value.$struct)
    if (isTag(value, '$infer')) return toExpected(value.$infer.value)
    if (isTag(value, '$variant')) return toExpected(value.$variant.value)
    if (isTag(value, '$dict')) {
        const object: Record<string, any> = {}
        value.$dict.forEach(([key, item]: [TaggedValue, TaggedValue]): any => object[keyString(toExpected(key))] = toExpected(item))
        return object
    }
    return value
}

/**
 * Splits a signature into its top-level complete types, e.g. 'ya{sv}(ii)' into ['y', 'a{sv}', '(ii)'].
 */
export function splitSignature(signature: string): string[] {
    const types: string[] = []
    let start: number = 0
    while (start < signature.length) {
        let end: number = start
        while (signature[end] === 'a') end++
        if (signature[end] === '(' || signature[end] === '{') {
            let depth: number = 0
            do {
                if (signature[end] === '(' || signature[end] === '{') depth++
                if (signature[end] === ')' || signature[end] === '}') depth--
                end++
            } while (depth > 0)
        } else {
            end++
        }
        types.push(signature.substring(start, end))
        start = end
    }
    return types
}

/**
 * Whether a case carries UNIX_FD values, which a real bus only accepts together with actual file descriptors.
 */
export function involvesUnixFd(testCase: MatrixCase): boolean {
    return testCase.signature.includes('h') || JSON.stringify(testCase.args).includes('"signature":"h"')
}
