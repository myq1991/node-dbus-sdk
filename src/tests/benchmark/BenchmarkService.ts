import EventEmitter from 'node:events'
import {LocalService} from '../../LocalService'
import {LocalObject} from '../../LocalObject'
import {LocalInterface} from '../../LocalInterface'

/**
 * Service side of the bus benchmarks, run in its own process so client and service do not share an event loop.
 *
 *     node build/tests/benchmark/BenchmarkService.js <bus address>
 *
 * Prints READY once it owns its name, and exits when its bus connection closes.
 */
export const BENCHMARK_SERVICE: string = 'org.example.Benchmark'
export const BENCHMARK_PATH: string = '/org/example/Benchmark'
export const BENCHMARK_INTERFACE: string = 'org.example.Benchmark'

async function main(): Promise<void> {
    const signals: EventEmitter = new EventEmitter()
    const iface: LocalInterface = new LocalInterface(BENCHMARK_INTERFACE)
        .defineMethod({
            name: 'Add',
            inputArgs: [{name: 'a', type: 'i'}, {name: 'b', type: 'i'}],
            outputArgs: [{name: 'sum', type: 'i'}],
            method: (a: number, b: number): number => a + b
        })
        .defineMethod({
            name: 'EchoBytes',
            inputArgs: [{name: 'value', type: 'ay'}],
            outputArgs: [{name: 'value', type: 'ay'}],
            method: (value: Buffer): Buffer => value
        })
        .defineMethod({
            name: 'EchoDict',
            inputArgs: [{name: 'value', type: 'a{sv}'}],
            outputArgs: [{name: 'value', type: 'a{sv}'}],
            method: (value: Record<string, any>): Record<string, any> => value
        })
        .defineMethod({
            name: 'EmitTicks',
            inputArgs: [{name: 'count', type: 'u'}],
            method: (count: number): void => {
                for (let i: number = 0; i < count; i++) signals.emit('Tick', i)
            }
        })
        .defineProperty({name: 'Label', type: 's', getter: (): string => 'benchmark'})
        .defineSignal({name: 'Tick', args: [{name: 'index', type: 'u'}], eventEmitter: signals})
    const object: LocalObject = new LocalObject(BENCHMARK_PATH)
    object.addInterface(iface)
    const service: LocalService = new LocalService(BENCHMARK_SERVICE)
    service.addObject(object)
    await service.run({busAddress: process.argv[2]})
    service.dbus.on('connectionClose', (): never => process.exit(0))
    console.log('READY')
}

if (require.main === module) {
    main().catch((error: Error): never => {
        console.error(error)
        process.exit(1)
    })
}
