import {readFileSync} from 'node:fs'
import path from 'node:path'
import {BenchmarkOutcome, formatValue, Metric} from './Harness'
import {BenchmarkReport, RESULTS_DIR} from './run'

/**
 * Compares two benchmark reports metric by metric.
 *
 *     npm run bench:compare -- <before> <after>
 *
 * Arguments are labels in src/tests/benchmark/results or paths to report files.
 * Changes within the measured run-to-run noise are reported as "same": ±10% for medians and rates, ±20% for tail
 * percentiles (p95, p99), which vary more between runs.
 */

function noise(metricName: string): number {
    return /p9\d/.test(metricName) ? 0.2 : 0.1
}

function load(reference: string): BenchmarkReport {
    const file: string = reference.endsWith('.json') ? path.resolve(reference) : path.join(RESULTS_DIR, `${reference}.json`)
    return JSON.parse(readFileSync(file, 'utf8'))
}

/**
 * Relative improvement: positive is better, regardless of whether the metric should go up or down.
 */
function improvement(before: Metric, after: Metric): number {
    if (before.value === 0) return 0
    const change: number = (after.value - before.value) / before.value
    return before.better === 'lower' ? -change : change
}

function verdict(metricName: string, before: Metric, after: Metric): string {
    const gain: number = improvement(before, after)
    if (Math.abs(gain) < noise(metricName)) return 'same'
    const factor: number = before.better === 'lower' ? before.value / after.value : after.value / before.value
    const label: string = factor >= 2 || factor <= 0.5 ? `${formatValue(factor >= 1 ? factor : 1 / factor)}× ` : ''
    return gain > 0 ? `${label}better` : `${label}WORSE`
}

function main(): void {
    const [beforeRef, afterRef] = process.argv.slice(2)
    if (!beforeRef || !afterRef) {
        console.error('usage: npm run bench:compare -- <before> <after>')
        process.exit(2)
    }
    const before: BenchmarkReport = load(beforeRef)
    const after: BenchmarkReport = load(afterRef)
    console.log(`before: ${before.label} (${before.environment.commit}, ${before.environment.node}, ${before.environment.cpu})`)
    console.log(`after:  ${after.label} (${after.environment.commit}, ${after.environment.node}, ${after.environment.cpu})`)
    if (before.environment.cpu !== after.environment.cpu || before.environment.node !== after.environment.node) {
        console.log('warning: different machine or Node.js version, numbers are not directly comparable')
    }
    const afterByName: Map<string, BenchmarkOutcome> = new Map(after.outcomes.map((outcome: BenchmarkOutcome): [string, BenchmarkOutcome] => [outcome.name, outcome]))
    for (const outcome of before.outcomes) {
        const other: BenchmarkOutcome | undefined = afterByName.get(outcome.name)
        console.log(`\n${outcome.name}`)
        if (!other) {
            console.log('  missing in the second report')
            continue
        }
        for (const [name, metric] of Object.entries(outcome.metrics)) {
            const otherMetric: Metric | undefined = other.metrics[name]
            if (!otherMetric) continue
            const change: number = before.outcomes.length && metric.value !== 0 ? (otherMetric.value - metric.value) / metric.value * 100 : 0
            console.log(`  ${name.padEnd(20)} ${formatValue(metric.value).padStart(12)} → ${formatValue(otherMetric.value).padStart(12)} ${metric.unit.padEnd(10)} ${(change >= 0 ? '+' : '') + change.toFixed(1)}%`.padEnd(80) + ` ${verdict(name, metric, otherMetric)}`)
        }
    }
}

main()
