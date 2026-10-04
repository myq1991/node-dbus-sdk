import {InvalidValueError} from './Errors'

/**
 * Describes a value for error messages.
 */
export function describe(value: any): string {
    if (typeof value === 'string') return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value)
    if (typeof value === 'bigint') return `${value}n`
    if (value === null || typeof value !== 'object') return String(value)
    return Object.prototype.toString.call(value)
}

/**
 * Checks that a value is an integer within [min, max] (a number, or a bigint for convenience) and returns it as a number.
 *
 * @throws {InvalidValueError} Otherwise, instead of writing a truncated, wrapped or NaN value.
 */
export function integer(value: any, min: number, max: number, typeName: string): number {
    const number: number = typeof value === 'bigint' ? Number(value) : value
    if (typeof number !== 'number' || !Number.isInteger(number) || number < min || number > max) {
        throw new InvalidValueError(`${typeName} must be an integer from ${min} to ${max}, got ${describe(value)}`)
    }
    return number
}

/**
 * Checks that a value is an integer within [min, max] given as a bigint, an integer number or a decimal string.
 *
 * @throws {InvalidValueError} Otherwise.
 */
export function integer64(value: any, min: bigint, max: bigint, typeName: string): bigint {
    let big: bigint | undefined
    try {
        if (typeof value === 'bigint') big = value
        else if (typeof value === 'number' && Number.isInteger(value)) big = BigInt(value)
        else if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) big = BigInt(value.trim())
    } catch {
        big = undefined
    }
    if (big === undefined || big < min || big > max) {
        throw new InvalidValueError(`${typeName} must be an integer from ${min} to ${max}, got ${describe(value)}`)
    }
    return big
}

/**
 * The range of each integer type code, as [min, max] in bigint.
 */
export const INTEGER_RANGES: Record<string, [bigint, bigint]> = {
    y: [0n, 0xFFn],
    n: [-0x8000n, 0x7FFFn],
    q: [0n, 0xFFFFn],
    i: [-0x80000000n, 0x7FFFFFFFn],
    u: [0n, 0xFFFFFFFFn],
    h: [0n, 0xFFFFFFFFn],
    x: [-(2n ** 63n), 2n ** 63n - 1n],
    t: [0n, 2n ** 64n - 1n]
}

/**
 * Whether a value would be accepted for an integer type code: a number or bigint within range, or, for the 64-bit
 * types, also a decimal string.
 */
export function fitsInteger(code: string, value: any): boolean {
    const [min, max] = INTEGER_RANGES[code]
    let big: bigint
    if (typeof value === 'bigint') big = value
    else if (typeof value === 'number' && Number.isInteger(value)) big = BigInt(value)
    else if ((code === 'x' || code === 't') && typeof value === 'string' && /^-?\d+$/.test(value.trim())) big = BigInt(value.trim())
    else return false
    return big >= min && big <= max
}
