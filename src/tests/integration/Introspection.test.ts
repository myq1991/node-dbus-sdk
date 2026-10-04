import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {parseStringPromise} from 'xml2js'
import {DBus} from '../../DBus'
import {DBusService} from '../../DBusService'
import {LocalService} from '../../LocalService'
import {LocalObject} from '../../LocalObject'
import {LocalInterface} from '../../LocalInterface'
import {PrivateBus} from '../helpers/PrivateBus'
import {gdbusCliAvailable} from '../helpers/GDBus'
import {withTimeout} from '../helpers/Async'
import {knownBug} from '../helpers/KnownBug'

const SERVICE_NAME: string = 'org.example.Tree'

/**
 * Objects of the test service. /org/example/Tree/ax shares a prefix with /org/example/Tree/a without being below it,
 * and /org/example/Other/deep/leaf has two path levels without objects above it.
 */
const OBJECT_PATHS: string[] = [
    '/org/example/Tree/a',
    '/org/example/Tree/a/b',
    '/org/example/Tree/ax',
    '/org/example/Other/deep/leaf'
]

interface IntrospectedNode {
    interfaces: string[]
    children: string[]
}

describe('introspection of an object tree', {skip: !PrivateBus.available && 'dbus-daemon not found', timeout: 30000}, (): void => {
    let bus: PrivateBus
    let service: LocalService
    let client: DBus

    before(async (): Promise<void> => {
        bus = await PrivateBus.start()
        service = new LocalService(SERVICE_NAME)
        for (const objectPath of OBJECT_PATHS) {
            const object: LocalObject = new LocalObject(objectPath)
            object.addInterface(new LocalInterface('org.example.Node').defineMethod({name: 'Ping', method: (): void => undefined}))
            service.addObject(object)
        }
        await withTimeout(service.run({busAddress: bus.address}), 3000, 'start service')
        client = await withTimeout(DBus.connect({busAddress: bus.address}), 3000, 'connect')
    })

    after(async (): Promise<void> => {
        await withTimeout(service.stop(), 2000, 'stop service').catch((): void => undefined)
        await withTimeout(client.disconnect(), 2000, 'disconnect').catch((): void => undefined)
        await bus.stop()
    })

    async function introspect(objectPath: string): Promise<IntrospectedNode> {
        const [xml] = await withTimeout(client.invoke({service: SERVICE_NAME, objectPath, interface: 'org.freedesktop.DBus.Introspectable', method: 'Introspect'}), 2000, `Introspect ${objectPath}`)
        const node: any = (await parseStringPromise(xml)).node || {}
        return {
            interfaces: (node.interface || []).map((item: any): string => item.$.name).sort(),
            children: (node.node || []).map((item: any): string => item.$.name).sort()
        }
    }

    const EXPECTED_CHILDREN: [string, string[]][] = [
        ['/', ['org']],
        ['/org', ['example']],
        ['/org/example', ['Other', 'Tree']],
        ['/org/example/Tree', ['a', 'ax']],
        ['/org/example/Tree/a/b', []],
        ['/org/example/Other', ['deep']],
        ['/org/example/Other/deep', ['leaf']]
    ]

    for (const [objectPath, children] of EXPECTED_CHILDREN) {
        it(`lists the children of ${objectPath}`, async (): Promise<void> => {
            assert.deepEqual((await introspect(objectPath)).children, children)
        })
    }

    it('does not list a sibling sharing a name prefix as a child', async (): Promise<void> => {
        assert.deepEqual((await introspect('/org/example/Tree/a')).children, ['b'])
    })

    it('describes the interfaces of an object, including the standard ones', async (): Promise<void> => {
        assert.deepEqual((await introspect('/org/example/Tree/a')).interfaces, [
            'org.example.Node',
            'org.freedesktop.DBus.Introspectable',
            'org.freedesktop.DBus.Peer',
            'org.freedesktop.DBus.Properties'
        ])
    })

    it('describes a path without an object as a node without interfaces', async (): Promise<void> => {
        assert.deepEqual((await introspect('/org/example/Other')).interfaces, [])
    })

    it('describes an unknown path as an empty node', async (): Promise<void> => {
        assert.deepEqual(await introspect('/does/not/exist'), {interfaces: [], children: []})
    })

    it('lists every object of the service', async (): Promise<void> => {
        const remote: DBusService = await withTimeout(client.getService(SERVICE_NAME), 2000, 'get service')
        assert.deepEqual((await withTimeout(remote.listObjects(), 3000, 'listObjects')).sort(), ['/', ...OBJECT_PATHS].sort())
    })

    it('produces XML that GDBus can parse, for the whole tree', {skip: !gdbusCliAvailable && 'gdbus not found'}, async (): Promise<void> => {
        const output: string = await new Promise<string>((resolve, reject): void => {
            execFile('gdbus', ['introspect', '--address', bus.address, '--dest', SERVICE_NAME, '--object-path', '/', '--recurse', '--only-properties'], {timeout: 5000}, (error, stdout: string, stderr: string): void => {
                if (error) return reject(new Error(stderr || error.message))
                resolve(stdout)
            })
        })
        for (const objectPath of OBJECT_PATHS) {
            assert.ok(output.includes(`node ${objectPath} {`), `gdbus did not reach ${objectPath}:\n${output}`)
        }
    })
})
