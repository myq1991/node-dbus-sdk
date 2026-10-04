import {DBusBufferEncoder} from '../../lib/DBusBufferEncoder'
import {DBusBufferDecoder} from '../../lib/DBusBufferDecoder'
import {DBusMessage} from '../../lib/DBusMessage'
import {Signature} from '../../lib/Signature'
import {DBusMessageEndianness} from '../../lib/enums/DBusMessageEndianness'
import {DBusMessageType} from '../../lib/enums/DBusMessageType'
import {DBusMessageFlags} from '../../lib/enums/DBusMessageFlags'
import {decodeWireMessage} from '../helpers/WireMessage'
import {BenchmarkOutcome, median, megabytesPerSecond, Metric, percentile, perSecond, sample, us} from './Harness'

interface CodecWorkload {
    name: string
    signature: string
    /**
     * Encoder input (one argument, or an array for multi-argument signatures).
     */
    value: any
    /**
     * Runs per measurement; large payloads are slow enough that a few runs suffice.
     */
    minRuns?: number
}

function strings(count: number): string[] {
    return Array.from({length: count}, (_value: unknown, index: number): string => `item-${index}`)
}

function dictionary(count: number): Record<string, number> {
    const value: Record<string, number> = {}
    for (let i: number = 0; i < count; i++) value[`key-${i}`] = i
    return value
}

/**
 * GetManagedObjects of a service with `count` objects, each with two interfaces of a few properties.
 */
function managedObjects(count: number): Record<string, Record<string, Record<string, any>>> {
    const value: Record<string, Record<string, Record<string, any>>> = {}
    for (let i: number = 0; i < count; i++) {
        value[`/org/example/Objects/item${i}`] = {
            'org.example.Item': {Name: `item ${i}`, Index: i, Enabled: i % 2 === 0, Tags: ['a', 'b'], Ratio: i / 3},
            'org.freedesktop.DBus.Properties': {}
        }
    }
    return value
}

/**
 * Workloads that every library version handles correctly, so before/after numbers stay comparable.
 * (Arrays of 8-byte types are avoided: they are mis-encoded before the alignment fix.)
 */
const WORKLOADS: CodecWorkload[] = [
    {name: 'method call arguments (su)', signature: 'su', value: ['org.example.Name', 42]},
    {name: 'PropertiesChanged (sa{sv}as)', signature: 'sa{sv}as', value: ['org.example.Interface', {Name: 'value', Count: 3, Enabled: true, Ratio: 0.5}, ['Invalidated']]},
    {name: 'GetManagedObjects, 200 objects', signature: 'a{oa{sa{sv}}}', value: managedObjects(200)},
    {name: 'ay 1 KiB', signature: 'ay', value: Buffer.alloc(1024, 7)},
    {name: 'ay 16 KiB', signature: 'ay', value: Buffer.alloc(16 * 1024, 7)},
    {name: 'ay 256 KiB', signature: 'ay', value: Buffer.alloc(256 * 1024, 7), minRuns: 3},
    {name: 'as 1000 strings', signature: 'as', value: strings(1000)},
    {name: 'as 10000 strings', signature: 'as', value: strings(10000), minRuns: 10},
    {name: 'a{si} 1000 entries', signature: 'a{si}', value: dictionary(1000)},
    {name: 'a{si} 4000 entries', signature: 'a{si}', value: dictionary(4000), minRuns: 3}
]

/**
 * Encoding and decoding of message bodies, in process.
 */
export async function codecBenchmarks(filter: (name: string) => boolean): Promise<BenchmarkOutcome[]> {
    const outcomes: BenchmarkOutcome[] = []
    for (const workload of WORKLOADS) {
        if (!filter(workload.name)) continue
        const options: { minRuns: number, warmup: number, minTimeMs: number } = {minRuns: workload.minRuns ?? 20, warmup: workload.minRuns ? 1 : 5, minTimeMs: workload.minRuns ? 0 : 500}
        const wire: Buffer = new DBusBufferEncoder().encode(workload.signature, workload.value)
        const encodeSamples: number[] = await sample((): Buffer => new DBusBufferEncoder().encode(workload.signature, workload.value), options)
        const decodeSamples: number[] = await sample((): any[] => new DBusBufferDecoder(DBusMessageEndianness.LE, wire).decode(workload.signature), options)
        const metrics: Record<string, Metric> = {
            'encode median': us(median(encodeSamples)),
            'encode p95': us(percentile(encodeSamples, 0.95)),
            'decode median': us(median(decodeSamples)),
            'decode p95': us(percentile(decodeSamples, 0.95))
        }
        if (wire.length >= 16 * 1024) {
            metrics['encode throughput'] = megabytesPerSecond(wire.length, median(encodeSamples))
            metrics['decode throughput'] = megabytesPerSecond(wire.length, median(decodeSamples))
        }
        outcomes.push({group: 'codec', name: `${workload.name} [${wire.length} bytes]`, metrics})
    }

    if (filter('complete method call message')) {
        const header: Record<string, any> = {
            serial: 1, type: DBusMessageType.METHOD_CALL, flags: DBusMessageFlags.REPLY_EXPECTED, destination: 'org.example.Service',
            path: '/org/example/Object', interfaceName: 'org.example.Interface', member: 'DoThing', signature: 'sa{sv}'
        }
        const raw: Buffer = DBusMessage.encode(header, 'argument', {key: 'value', count: 1})
        const encodeSamples: number[] = await sample((): Buffer => DBusMessage.encode(header, 'argument', {key: 'value', count: 1}))
        const decodeSamples: number[] = await sample((): DBusMessage => decodeWireMessage(raw))
        outcomes.push({
            group: 'codec',
            name: `complete method call message (header + sa{sv}) [${raw.length} bytes]`,
            metrics: {
                'encode median': us(median(encodeSamples)),
                'decode median': us(median(decodeSamples)),
                'encode rate': perSecond(1000 / median(encodeSamples), 'messages'),
                'decode rate': perSecond(1000 / median(decodeSamples), 'messages')
            }
        })
    }

    if (filter('signature parsing')) {
        const signatureSamples: number[] = await sample((): any => Signature.parse('a{oa{sa{sv}}}(ia{s(xv)})as'))
        outcomes.push({group: 'codec', name: 'signature parsing (a{oa{sa{sv}}}(ia{s(xv)})as)', metrics: {'parse median': us(median(signatureSamples))}})
    }
    return outcomes
}
