import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {ChildProcess, spawn} from 'node:child_process'
import path from 'node:path'
import {createInterface, Interface} from 'node:readline'
import {LocalService} from '../../LocalService'
import {LocalObject} from '../../LocalObject'
import {LocalInterface} from '../../LocalInterface'
import {PrivateBus, releaseWhenDone} from '../helpers/PrivateBus'
import {pygobjectAvailable} from '../helpers/GDBus'
import {withTimeout} from '../helpers/Async'

const CLIENT: string = path.resolve(__dirname, '../../../src/tests/fixtures/gdbus/object_manager_client.py')

/**
 * A GDBusObjectManagerClient (fixtures/gdbus/object_manager_client.py) following a service: each step reports the
 * events GDBus raised and its view of the objects, with each property's GVariant type.
 */
class GDBusObjectManagerClient {

    readonly #child: ChildProcess

    readonly #lines: Interface

    readonly #reports: any[] = []

    #waiting: ((report: any) => void) | undefined

    protected constructor(child: ChildProcess) {
        this.#child = child
        this.#lines = createInterface({input: child.stdout!})
        this.#lines.on('line', (line: string): void => {
            const report: any = JSON.parse(line)
            if (this.#waiting) {
                const resolve: (report: any) => void = this.#waiting
                this.#waiting = undefined
                resolve(report)
            } else {
                this.#reports.push(report)
            }
        })
    }

    public static async start(address: string, service: string, managerPath: string): Promise<{ client: GDBusObjectManagerClient, view: any }> {
        const child: ChildProcess = spawn('python3', [CLIENT, address, service, managerPath], {stdio: ['pipe', 'pipe', 'inherit']})
        releaseWhenDone(child)
        const client: GDBusObjectManagerClient = new GDBusObjectManagerClient(child)
        const ready: any = await withTimeout(client.#next(), 5000, 'GDBus client ready')
        return {client, view: ready.ready}
    }

    #next(): Promise<any> {
        if (this.#reports.length) return Promise.resolve(this.#reports.shift())
        return new Promise((resolve): void => {
            this.#waiting = resolve
        })
    }

    /**
     * Runs a change in the service and returns what the GDBus client saw.
     */
    public async step(name: string, action: () => unknown): Promise<{ events: any[][], view: any }> {
        await action()
        await new Promise((resolve): NodeJS.Immediate => setImmediate(resolve))
        this.#child.stdin!.write(`${name}\n`)
        const report: any = await withTimeout(this.#next(), 5000, `GDBus client step ${name}`)
        assert.equal(report.step, name)
        return report
    }

    public stop(): void {
        this.#child.stdin!.end('quit\n')
        this.#lines.close()
    }
}

function device(id: string, state: { level: number }): LocalInterface {
    return new LocalInterface('org.example.Device1')
        .defineProperty({name: 'Id', type: 's', getter: (): string => id})
        .defineProperty({name: 'Level', type: 'u', getter: (): number => state.level})
}

/**
 * The service side of ObjectManager checked by GLib's GDBusObjectManagerClient, the client BlueZ, UDisks and
 * NetworkManager tools are built on.
 */
describe('ObjectManager with a GDBus client', {skip: (!PrivateBus.available && 'dbus-daemon not found') || (!pygobjectAvailable && 'PyGObject not found'), timeout: 60000}, (): void => {
    let bus: PrivateBus

    before(async (): Promise<void> => {
        bus = await PrivateBus.start()
    })

    after(async (): Promise<void> => {
        await bus.stop()
    })

    it('follows objects, interfaces and properties as the service changes them', async (): Promise<void> => {
        const state = {level: 50}
        const sdaDevice: LocalInterface = device('sda', state)
        const sda: LocalObject = new LocalObject('/org/example/devices/sda')
        sda.addInterface(sdaDevice)
        const service: LocalService = new LocalService('org.example.InteropDevices')
        service.addObject(sda)
        await service.run({busAddress: bus.address})
        const {client, view} = await GDBusObjectManagerClient.start(bus.address, service.name, '/')
        try {
            assert.deepEqual(Object.keys(view), ['/org/example/devices/sda'])
            assert.deepEqual(view['/org/example/devices/sda']['org.example.Device1'], {Id: ['s', 'sda'], Level: ['u', 50]})

            const sdb: LocalObject = new LocalObject('/org/example/devices/sdb')
            sdb.addInterface(device('sdb', {level: 10}))
            let report = await client.step('add object', (): boolean => service.addObject(sdb))
            assert.deepEqual(report.events, [['object-added', '/org/example/devices/sdb']])
            assert.deepEqual(report.view['/org/example/devices/sdb']['org.example.Device1'], {Id: ['s', 'sdb'], Level: ['u', 10]})

            report = await client.step('add interface', (): boolean => sdb.addInterface(new LocalInterface('org.example.Battery1').defineProperty({name: 'Percent', type: 'd', getter: (): number => 0.5})))
            assert.deepEqual(report.events, [['interface-added', '/org/example/devices/sdb', 'org.example.Battery1']])
            assert.deepEqual(report.view['/org/example/devices/sdb']['org.example.Battery1'], {Percent: ['d', 0.5]})

            report = await client.step('announce a read-only property', (): void => {
                state.level = 80
                sdaDevice.emitPropertiesChanged('Level')
            })
            assert.deepEqual(report.events, [['properties-changed', '/org/example/devices/sda', 'org.example.Device1', ['Level'], []]])
            assert.deepEqual(report.view['/org/example/devices/sda']['org.example.Device1'].Level, ['u', 80])

            report = await client.step('remove interface', (): boolean => sdb.removeInterface('org.example.Battery1'))
            assert.deepEqual(report.events, [['interface-removed', '/org/example/devices/sdb', 'org.example.Battery1']])

            report = await client.step('remove object', (): boolean => service.removeObject(sdb))
            assert.deepEqual(report.events, [['object-removed', '/org/example/devices/sdb']])
            assert.deepEqual(Object.keys(report.view), ['/org/example/devices/sda'])

            report = await client.step('change the manager\'s own object', (): boolean => service.getObject('/')!.addInterface(new LocalInterface('org.example.Root1')))
            assert.deepEqual(report.events, [])
            assert.deepEqual(Object.keys(report.view), ['/org/example/devices/sda'])
        } finally {
            client.stop()
            await service.stop()
        }
    })

    it('works with a manager at another path', async (): Promise<void> => {
        const service: LocalService = new LocalService('org.example.InteropApp', {objectManagerPath: '/org/example/App'})
        const inside: LocalObject = new LocalObject('/org/example/App/item')
        inside.addInterface(device('item', {level: 1}))
        service.addObject(inside)
        await service.run({busAddress: bus.address})
        const {client, view} = await GDBusObjectManagerClient.start(bus.address, service.name, '/org/example/App')
        try {
            assert.deepEqual(Object.keys(view), ['/org/example/App/item'])
            const later: LocalObject = new LocalObject('/org/example/App/later')
            later.addInterface(device('later', {level: 2}))
            const report = await client.step('add object', (): boolean => service.addObject(later))
            assert.deepEqual(report.events, [['object-added', '/org/example/App/later']])
        } finally {
            client.stop()
            await service.stop()
        }
    })
})
