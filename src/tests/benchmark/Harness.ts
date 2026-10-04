/**
 * Minimal benchmark harness: repeats an operation, collects per-run durations and summarises them.
 */

export interface Metric {
    value: number
    unit: string
    /**
     * Which direction is an improvement.
     */
    better: 'lower' | 'higher'
}

export interface BenchmarkOutcome {
    group: string
    name: string
    metrics: Record<string, Metric>
    /**
     * Set when the benchmark could not run; the reason is reported instead of metrics.
     */
    error?: string
}

export interface SampleOptions {
    /**
     * Runs before measuring, to let the JIT settle.
     */
    warmup?: number
    minRuns?: number
    maxRuns?: number
    /**
     * Keep measuring until this much time has been spent (and minRuns reached).
     */
    minTimeMs?: number
}

/**
 * Times `operation` repeatedly and returns the duration of each run in milliseconds.
 */
export async function sample(operation: () => unknown, options: SampleOptions = {}): Promise<number[]> {
    const warmup: number = options.warmup ?? 3
    const minRuns: number = options.minRuns ?? 5
    const maxRuns: number = options.maxRuns ?? 10000
    const minTimeMs: number = options.minTimeMs ?? 500
    for (let i: number = 0; i < warmup; i++) await operation()
    // Start from a clean heap so garbage left by earlier benchmarks is not collected during this one
    ;(globalThis as any).gc?.()
    const samples: number[] = []
    const started: number = performance.now()
    while (samples.length < maxRuns && (samples.length < minRuns || performance.now() - started < minTimeMs)) {
        const start: bigint = process.hrtime.bigint()
        await operation()
        samples.push(Number(process.hrtime.bigint() - start) / 1e6)
    }
    return samples
}

export function percentile(samples: number[], fraction: number): number {
    const sorted: number[] = [...samples].sort((a: number, b: number): number => a - b)
    return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))]
}

export function median(samples: number[]): number {
    return percentile(samples, 0.5)
}

export function ms(value: number): Metric {
    return {value, unit: 'ms', better: 'lower'}
}

export function us(valueMs: number): Metric {
    return {value: valueMs * 1000, unit: 'µs', better: 'lower'}
}

export function perSecond(value: number, unit: string): Metric {
    return {value, unit: `${unit}/s`, better: 'higher'}
}

export function megabytesPerSecond(bytes: number, durationMs: number): Metric {
    return {value: bytes / 1024 / 1024 / (durationMs / 1000), unit: 'MiB/s', better: 'higher'}
}

export function kibibytes(bytes: number): Metric {
    return {value: bytes / 1024, unit: 'KiB', better: 'lower'}
}

/**
 * Formats a metric value with a sensible number of significant digits.
 */
export function formatValue(value: number): string {
    if (!Number.isFinite(value)) return String(value)
    const magnitude: number = Math.abs(value)
    if (magnitude >= 1000) return Math.round(value).toLocaleString('en-US')
    if (magnitude >= 100) return value.toFixed(0)
    if (magnitude >= 10) return value.toFixed(1)
    if (magnitude >= 1) return value.toFixed(2)
    return value.toPrecision(3)
}
