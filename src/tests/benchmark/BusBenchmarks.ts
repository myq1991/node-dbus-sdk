import {ChildProcess, spawn} from 'node:child_process'
import path from 'node:path'
import v8 from 'node:v8'
import vm from 'node:vm'
import {DBus} from '../../DBus'
import {DBusInterface} from '../../DBusInterface'
import {PrivateBus, releaseWhenDone} from '../helpers/PrivateBus'
import {withTimeout} from '../helpers/Async'
import {BENCHMARK_INTERFACE, BENCHMARK_PATH, BENCHMARK_SERVICE} from './BenchmarkService'
import {BenchmarkOutcome, kibibytes, median, megabytesPerSecond, ms, percentile, perSecond, sample, us} from './Harness'

async function startService(address: string): Promise<ChildProcess> {
    const child: ChildProcess = spawn(process.execPath, [path.join(__dirname, 'BenchmarkService.js'), address], {stdio: ['ignore', 'pipe', 'pipe']})
    await withTimeout(new Promise<void>((resolve, reject): void => {
        let stderr: string = ''
        child.stdout!.on('data', (chunk: Buffer): void => {
            if (chunk.toString().includes('READY')) resolve()
        })
        child.stderr!.on('data', (chunk: Buffer): string => stderr += chunk.toString())
        child.once('exit', (code: number | null): void => reject(new Error(`benchmark service exited with code ${code}: ${stderr}`)))
    }), 10000, 'start benchmark service')
    releaseWhenDone(child)
    return child
}

/**
 * Runs `total` calls with at most `concurrency` in flight and returns the elapsed milliseconds.
 */
async function concurrentCalls(total: number, concurrency: number, call: () => Promise<unknown>): Promise<number> {
    let started: number = 0
    const begin: number = performance.now()
    await Promise.all(Array.from({length: concurrency}, async (): Promise<void> => {
        while (started < total) {
            started++
            await call()
        }
    }))
    return performance.now() - begin
}

function collectGarbage(): (() => void) | undefined {
    try {
        v8.setFlagsFromString('--expose-gc')
        return vm.runInNewContext('gc')
    } catch {
        return undefined
    }
}

/**
 * End-to-end benchmarks through a private dbus-daemon, with the service in a separate process.
 */
export async function busBenchmarks(filter: (name: string) => boolean): Promise<BenchmarkOutcome[]> {
    if (!PrivateBus.available) return [{group: 'bus', name: 'all bus benchmarks', metrics: {}, error: 'dbus-daemon not found'}]
    const outcomes: BenchmarkOutcome[] = []
    const bus: PrivateBus = await PrivateBus.start()
    const service: ChildProcess = await startService(bus.address)
    const client: DBus = await DBus.connect({busAddress: bus.address})
    try {
        const iface: DBusInterface = await client.getInterface(BENCHMARK_SERVICE, BENCHMARK_PATH, BENCHMARK_INTERFACE)
        const add = (): Promise<number> => iface.method.Add(1, 2)

        if (filter('method call latency')) {
            const samples: number[] = await sample(add, {warmup: 200, minRuns: 2000, minTimeMs: 0, maxRuns: 2000})
            outcomes.push({
                group: 'bus', name: 'method call latency, sequential Add(ii) → i, 2000 calls',
                metrics: {'p50': us(median(samples)), 'p95': us(percentile(samples, 0.95)), 'p99': us(percentile(samples, 0.99)), 'rate': perSecond(1000 / median(samples), 'calls')}
            })
        }

        if (filter('method call throughput')) {
            for (const concurrency of [16, 128]) {
                const elapsed: number[] = await sample((): Promise<number> => concurrentCalls(10000, concurrency, add), {warmup: 1, minRuns: 7, minTimeMs: 0})
                outcomes.push({group: 'bus', name: `method call throughput, 10000 Add calls, ${concurrency} in flight`, metrics: {'rate': perSecond(10000 / (median(elapsed) / 1000), 'calls'), 'total': ms(median(elapsed))}})
            }
        }

        if (filter('property get latency')) {
            const samples: number[] = await sample((): Promise<string> => iface.property.Label.get(), {warmup: 100, minRuns: 1000, minTimeMs: 0, maxRuns: 1000})
            outcomes.push({group: 'bus', name: 'property get latency, 1000 Properties.Get calls', metrics: {'p50': us(median(samples)), 'p95': us(percentile(samples, 0.95))}})
        }

        if (filter('payload round trip')) {
            for (const size of [1024, 64 * 1024, 256 * 1024]) {
                const payload: Buffer = Buffer.alloc(size, 7)
                const samples: number[] = await sample((): Promise<Buffer> => iface.method.EchoBytes(payload), {warmup: 1, minRuns: size > 100000 ? 3 : size > 10000 ? 9 : 50, minTimeMs: 0})
                outcomes.push({
                    group: 'bus', name: `payload round trip, EchoBytes(ay) ${size / 1024} KiB`,
                    metrics: {'median': ms(median(samples)), 'throughput': megabytesPerSecond(2 * size, median(samples))}
                })
            }
            const dictionary: Record<string, number> = {}
            for (let i: number = 0; i < 1000; i++) dictionary[`key-${i}`] = i
            const samples: number[] = await sample((): Promise<Record<string, any>> => iface.method.EchoDict(dictionary), {warmup: 1, minRuns: 5, minTimeMs: 0})
            outcomes.push({group: 'bus', name: 'payload round trip, EchoDict(a{sv}) 1000 entries', metrics: {'median': ms(median(samples))}})
        }

        if (filter('signal throughput')) {
            const count: number = 20000
            const elapsed: number[] = await sample(async (): Promise<void> => {
                let received: number = 0
                const done: Promise<void> = new Promise<void>((resolve): void => {
                    const listener = (): void => {
                        if (++received < count) return
                        iface.signal.off('Tick', listener)
                        resolve()
                    }
                    iface.signal.on('Tick', listener)
                })
                await client.listNames()
                await iface.method.EmitTicks(count)
                await withTimeout(done, 30000, 'signals')
            }, {warmup: 2, minRuns: 15, minTimeMs: 0})
            outcomes.push({group: 'bus', name: `signal throughput, ${count} signals from service to client`, metrics: {'rate': perSecond(count / (median(elapsed) / 1000), 'signals'), 'total': ms(median(elapsed))}})
        }

        if (filter('connection setup')) {
            const samples: number[] = await sample(async (): Promise<void> => {
                const connection: DBus = await DBus.connect({busAddress: bus.address})
                const remote: DBusInterface = await connection.getInterface(BENCHMARK_SERVICE, BENCHMARK_PATH, BENCHMARK_INTERFACE)
                await remote.method.Add(1, 2)
                await connection.disconnect()
            }, {warmup: 3, minRuns: 30, minTimeMs: 0, maxRuns: 30})
            outcomes.push({group: 'bus', name: 'connection setup: connect, getInterface, first call, disconnect', metrics: {'median': ms(median(samples)), 'p95': ms(percentile(samples, 0.95))}})
        }

        if (filter('memory per call')) {
            const gc: (() => void) | undefined = collectGarbage()
            if (!gc) {
                outcomes.push({group: 'bus', name: 'memory retained per 1000 calls', metrics: {}, error: 'garbage collection not available'})
            } else {
                const calls: number = 20000
                for (let i: number = 0; i < 500; i++) await add()
                gc()
                const before: number = process.memoryUsage().heapUsed
                for (let i: number = 0; i < calls; i++) await add()
                gc()
                const retained: number = process.memoryUsage().heapUsed - before
                outcomes.push({group: 'bus', name: `memory retained per 1000 calls (after ${calls} sequential calls and GC)`, metrics: {'heap growth': kibibytes(Math.max(0, retained) / (calls / 1000))}})
            }
        }
    } finally {
        await withTimeout(client.disconnect(), 2000, 'disconnect').catch((): void => undefined)
        service.kill('SIGTERM')
        await bus.stop()
    }
    return outcomes
}
