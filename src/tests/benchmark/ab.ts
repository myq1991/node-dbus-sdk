import {execFileSync, execSync} from 'node:child_process'
import {mkdtempSync, readFileSync, rmSync, symlinkSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {formatValue, Metric} from './Harness'
import {BenchmarkReport, RESULTS_DIR} from './run'

/**
 * A/B comparison of the working tree against another commit, robust against machine drift.
 *
 *     npm run bench:ab -- [<commit>] [--rounds <n>] [--filter <text>]
 *
 * Checks out <commit> (default: the commit the 1.0.16 baseline was measured on) in a temporary worktree, builds it,
 * then runs its benchmarks and the working tree's alternately (old, new, old, new, ...). A metric counts as changed
 * only when the difference exceeds 10% and twice the spread between runs of the same version, because results drift
 * between sessions by more than the noise of back-to-back runs.
 */

const ROOT: string = path.resolve(__dirname, '../../..')
const BASELINE_COMMIT: string = '156cd7d'

function argument(name: string): string | undefined {
    const index: number = process.argv.indexOf(`--${name}`)
    return index >= 0 ? process.argv[index + 1] : undefined
}

function metricsOf(report: BenchmarkReport): Map<string, Metric> {
    return new Map(report.outcomes.flatMap((outcome) => Object.entries(outcome.metrics).map(([name, metric]): [string, Metric] => [`${outcome.name} :: ${name}`, metric])))
}

function dependenciesOf(directory: string): string {
    const manifest: Record<string, any> = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'))
    return JSON.stringify({...manifest.dependencies, ...manifest.devDependencies})
}

function runBenchmarks(directory: string, label: string, filter: string | undefined): BenchmarkReport {
    const args: string[] = ['--expose-gc', path.join(directory, 'build/tests/benchmark/run.js'), '--label', label]
    if (filter) args.push('--filter', filter)
    execFileSync(process.execPath, args, {cwd: directory, stdio: 'ignore'})
    const file: string = path.join(directory, 'src/tests/benchmark/results', `${label}.json`)
    const report: BenchmarkReport = JSON.parse(readFileSync(file, 'utf8'))
    rmSync(file)
    return report
}

function main(): void {
    const positional: string[] = process.argv.slice(2).filter((value: string, index: number, all: string[]): boolean => !value.startsWith('--') && !all[index - 1]?.startsWith('--'))
    const commit: string = positional[0] || BASELINE_COMMIT
    const rounds: number = parseInt(argument('rounds') || '2')
    const filter: string | undefined = argument('filter')
    const worktree: string = mkdtempSync(path.join(os.tmpdir(), 'dbus-sdk-ab-'))
    try {
        execSync(`git worktree add --detach "${worktree}" ${commit}`, {cwd: ROOT, stdio: 'ignore'})
        if (dependenciesOf(worktree) === dependenciesOf(ROOT)) {
            symlinkSync(path.join(ROOT, 'node_modules'), path.join(worktree, 'node_modules'))
        } else {
            // The other commit needs different packages (e.g. ones removed since), so give it its own
            console.log(`installing the dependencies of ${commit}`)
            execSync('npm install --no-audit --no-fund', {cwd: worktree, stdio: 'ignore'})
        }
        execSync('npx tsc -p .', {cwd: worktree, stdio: 'inherit'})
        const old: BenchmarkReport[] = []
        const current: BenchmarkReport[] = []
        for (let round: number = 1; round <= rounds; round++) {
            console.log(`round ${round}/${rounds}: ${commit}`)
            old.push(runBenchmarks(worktree, `ab-old-${round}`, filter))
            console.log(`round ${round}/${rounds}: working tree`)
            current.push(runBenchmarks(ROOT, `ab-new-${round}`, filter))
        }
        report(commit, old, current)
    } finally {
        execSync(`git worktree remove --force "${worktree}"`, {cwd: ROOT, stdio: 'ignore'})
        rmSync(worktree, {recursive: true, force: true})
    }
}

function report(commit: string, old: BenchmarkReport[], current: BenchmarkReport[]): void {
    const oldMetrics: Map<string, Metric>[] = old.map(metricsOf)
    const newMetrics: Map<string, Metric>[] = current.map(metricsOf)
    const mean = (values: number[]): number => values.reduce((sum: number, value: number): number => sum + value, 0) / values.length
    const spread = (values: number[]): number => (Math.max(...values) - Math.min(...values)) / mean(values)
    let changed: number = 0
    let compared: number = 0
    console.log(`\n${commit} → working tree (${old.length} interleaved rounds each)\n`)
    for (const [key, metric] of oldMetrics[0]) {
        if (!newMetrics.every((metrics: Map<string, Metric>): boolean => metrics.has(key))) continue
        compared++
        const before: number[] = oldMetrics.map((metrics: Map<string, Metric>): number => metrics.get(key)!.value)
        const after: number[] = newMetrics.map((metrics: Map<string, Metric>): number => metrics.get(key)!.value)
        const factor: number = metric.better === 'lower' ? mean(before) / mean(after) : mean(after) / mean(before)
        const noise: number = Math.max(spread(before), spread(after))
        if (Math.abs(factor - 1) <= 0.1 || Math.abs(factor - 1) <= 2 * noise) continue
        changed++
        const verdict: string = factor >= 1 ? `${formatValue(factor)}× better` : `${formatValue(1 / factor)}× WORSE`
        console.log(`${verdict.padEnd(16)} ${formatValue(mean(before)).padStart(12)} → ${formatValue(mean(after)).padStart(12)} ${metric.unit.padEnd(10)} (spread ${(noise * 100).toFixed(0)}%)  ${key}`)
    }
    console.log(`\n${changed} of ${compared} metrics changed beyond 10% and twice the run-to-run spread; the rest are unchanged.`)
    console.log(`Reports of single runs can be compared with npm run bench:compare; results directory: ${path.relative(process.cwd(), RESULTS_DIR)}`)
}

main()
