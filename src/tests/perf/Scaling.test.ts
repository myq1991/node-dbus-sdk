import {describe, it, TestContext} from 'node:test'
import assert from 'node:assert/strict'
import {DBusBufferEncoder} from '../../lib/DBusBufferEncoder'
import {DBusBufferDecoder} from '../../lib/DBusBufferDecoder'
import {DBusMessageEndianness} from '../../lib/enums/DBusMessageEndianness'
import {knownBug} from '../helpers/KnownBug'

/**
 * Inputs grow by this factor between the small and the large measurement.
 * Linear code takes ~GROWTH times longer; quadratic code ~GROWTH² times longer.
 */
const GROWTH: number = 8

/**
 * Maximum accepted slowdown for GROWTH times more input. Sits between linear (8) and quadratic (64) with room for noise.
 */
const MAX_SLOWDOWN: number = GROWTH * 2.5

function medianMs(fn: () => void, runs: number = 5): number {
    const samples: number[] = []
    for (let i: number = 0; i < runs; i++) {
        const start: bigint = process.hrtime.bigint()
        fn()
        samples.push(Number(process.hrtime.bigint() - start) / 1e6)
    }
    return samples.sort((a: number, b: number): number => a - b)[Math.floor(runs / 2)]
}

/**
 * Measures how much slower an operation gets when its input grows by GROWTH and asserts the growth is roughly linear.
 *
 * @param t - Test context, used to report the measurements.
 * @param size - Small input size; the large input is size * GROWTH.
 * @param prepare - Builds the operation to time for a given input size.
 */
function assertLinear(t: TestContext, size: number, prepare: (n: number) => () => void): void {
    const small: () => void = prepare(size)
    const large: () => void = prepare(size * GROWTH)
    small()
    large()
    const smallMs: number = medianMs(small)
    const largeMs: number = medianMs(large)
    const slowdown: number = largeMs / smallMs
    t.diagnostic(`n=${size}: ${smallMs.toFixed(2)}ms, n=${size * GROWTH}: ${largeMs.toFixed(2)}ms, slowdown ${slowdown.toFixed(1)}x (linear ≈ ${GROWTH}x, quadratic ≈ ${GROWTH * GROWTH}x)`)
    assert.ok(slowdown < MAX_SLOWDOWN, `slowdown ${slowdown.toFixed(1)}x for ${GROWTH}x input exceeds ${MAX_SLOWDOWN}x`)
}

function encoder(signature: string, value: any): () => Buffer {
    return (): Buffer => new DBusBufferEncoder().encode(signature, value)
}

function decoder(signature: string, value: any): () => any[] {
    const wire: Buffer = new DBusBufferEncoder().encode(signature, value)
    return (): any[] => new DBusBufferDecoder(DBusMessageEndianness.LE, wire).decode(signature)
}

function strings(n: number): string[] {
    return Array.from({length: n}, (_v: unknown, i: number): string => `item-${i}`)
}

function dictionary(n: number): Record<string, number> {
    const value: Record<string, number> = {}
    for (let i: number = 0; i < n; i++) value[`key-${i}`] = i
    return value
}

describe('encoding scales linearly with payload size', (): void => {
    it('ay', knownBug('every write concatenates the whole buffer (Buffer.concat per value)'), (t: TestContext): void => {
        assertLinear(t, 8 * 1024, (n: number): () => Buffer => encoder('ay', Buffer.alloc(n, 7)))
    })

    it('as', knownBug('every write concatenates the whole buffer (Buffer.concat per value)'), (t: TestContext): void => {
        assertLinear(t, 2000, (n: number): () => Buffer => encoder('as', strings(n)))
    })

    it('a{si}', knownBug('every write concatenates the whole buffer (Buffer.concat per value)'), (t: TestContext): void => {
        assertLinear(t, 500, (n: number): () => Buffer => encoder('a{si}', dictionary(n)))
    })
})

describe('decoding scales linearly with payload size', (): void => {
    it('ay', (t: TestContext): void => {
        assertLinear(t, 8 * 1024, (n: number): () => any[] => decoder('ay', Buffer.alloc(n, 7)))
    })

    it('as', (t: TestContext): void => {
        assertLinear(t, 2000, (n: number): () => any[] => decoder('as', strings(n)))
    })

    it('a{si}', knownBug('dictionary entries are merged with object spread, copying all previous keys each time'), (t: TestContext): void => {
        assertLinear(t, 500, (n: number): () => any[] => decoder('a{si}', dictionary(n)))
    })
})
