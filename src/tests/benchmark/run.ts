import {execSync} from 'node:child_process'
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {BenchmarkOutcome, formatValue} from './Harness'
import {codecBenchmarks} from './CodecBenchmarks'
import {busBenchmarks} from './BusBenchmarks'

/**
 * Runs the benchmarks and stores the results.
 *
 *     npm run bench -- [--label <name>] [--filter <text>]
 *
 * Results are written to src/tests/benchmark/results/<label>.json (default label: current date and commit).
 * Compare two runs with `npm run bench:compare -- <before> <after>`.
 */

export const RESULTS_DIR: string = path.resolve(__dirname, '../../../src/tests/benchmark/results')

export interface BenchmarkReport {
    label: string
    date: string
    environment: Record<string, string | number>
    outcomes: BenchmarkOutcome[]
}

function argument(name: string): string | undefined {
    const index: number = process.argv.indexOf(`--${name}`)
    return index >= 0 ? process.argv[index + 1] : undefined
}

function git(command: string): string {
    try {
        return execSync(`git ${command}`, {cwd: path.resolve(__dirname, '../../..'), stdio: ['ignore', 'pipe', 'ignore']}).toString().trim()
    } catch {
        return 'unknown'
    }
}

function environment(): Record<string, string | number> {
    const packageJson: Record<string, any> = JSON.parse(readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8'))
    return {
        library: `${packageJson.name}@${packageJson.version}`,
        // Only changes to the library itself (not to the tests or benchmarks) make the commit an inaccurate description
        commit: git('rev-parse --short HEAD') + (git('status --porcelain -- src ":!src/tests"') ? ' (with uncommitted library changes)' : ''),
        node: process.version,
        platform: `${os.platform()} ${os.release()} ${os.arch()}`,
        cpu: `${os.cpus()[0]?.model} × ${os.cpus().length}`,
        memory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GiB`,
        dbusDaemon: (() => {
            try {
                return execSync(`${process.env.DBUS_DAEMON || 'dbus-daemon'} --version`).toString().split('\n')[0]
            } catch {
                return 'not found'
            }
        })()
    }
}

function print(outcomes: BenchmarkOutcome[]): void {
    let group: string = ''
    for (const outcome of outcomes) {
        if (outcome.group !== group) {
            group = outcome.group
            console.log(`\n=== ${group} ===`)
        }
        console.log(`\n${outcome.name}`)
        if (outcome.error) console.log(`  skipped: ${outcome.error}`)
        for (const [metric, value] of Object.entries(outcome.metrics)) {
            console.log(`  ${metric.padEnd(20)} ${formatValue(value.value).padStart(12)} ${value.unit}`)
        }
    }
}

async function main(): Promise<void> {
    const text: string | undefined = argument('filter')
    const filter = (name: string): boolean => !text || name.toLowerCase().includes(text.toLowerCase())
    const env: Record<string, string | number> = environment()
    const label: string = argument('label') || `${new Date().toISOString().slice(0, 10)}-${String(env.commit).split(' ')[0]}`
    console.log(Object.entries(env).map(([key, value]): string => `${key}: ${value}`).join('\n'))
    const outcomes: BenchmarkOutcome[] = [...await codecBenchmarks(filter), ...await busBenchmarks(filter)]
    print(outcomes)
    const report: BenchmarkReport = {label, date: new Date().toISOString(), environment: env, outcomes}
    mkdirSync(RESULTS_DIR, {recursive: true})
    const file: string = path.join(RESULTS_DIR, `${label}.json`)
    writeFileSync(file, JSON.stringify(report, null, 2) + '\n')
    console.log(`\nSaved ${path.relative(process.cwd(), file)}`)
}

if (require.main === module) {
    main().then((): never => process.exit(0), (error: Error): never => {
        console.error(error)
        process.exit(1)
    })
}
