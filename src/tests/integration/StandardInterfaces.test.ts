import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBus} from '../../DBus'
import {DBusInterface} from '../../DBusInterface'
import {LocalService} from '../../LocalService'
import {LocalObject} from '../../LocalObject'
import {LocalInterface} from '../../LocalInterface'
import {PrivateBus} from '../helpers/PrivateBus'
import {gdbusCall, gdbusCliAvailable} from '../helpers/GDBus'
import {nextEvent, withTimeout} from '../helpers/Async'
import {knownBug} from '../helpers/KnownBug'

const SERVICE_NAME: string = 'org.example.Standard'
const PATH: string = '/org/example/Standard'
const INTERFACE: string = 'org.example.Props'

/**
 * org.freedesktop.DBus.Properties and org.freedesktop.DBus.Peer as provided by every LocalObject, called through the bus
 * by this library's client and by gdbus.
 */
describe('standard interfaces of a LocalObject', {skip: !PrivateBus.available && 'dbus-daemon not found', timeout: 30000}, (): void => {
    let bus: PrivateBus
    let service: LocalService
    let client: DBus
    let properties: DBusInterface
    const state: { name: string, mode: string, delayed: string } = {name: 'initial', mode: 'auto', delayed: 'initial'}

    before(async (): Promise<void> => {
        bus = await PrivateBus.start()
        const object: LocalObject = new LocalObject(PATH)
        object.addInterface(new LocalInterface(INTERFACE)
            .defineProperty({name: 'Name', type: 's', emitPropertiesChanged: true, getter: (): string => state.name, setter: (value: string): string => state.name = value})
            .defineProperty({name: 'Count', type: 'u', getter: (): number => 7})
            .defineProperty({
                name: 'Delayed', type: 's', emitPropertiesChanged: true, getter: (): string => state.delayed,
                setter: async (value: string): Promise<void> => {
                    await new Promise<void>((resolve): NodeJS.Timeout => setTimeout(resolve, 20))
                    state.delayed = value
                }
            })
            .defineProperty({name: 'Mode', type: 's', emitPropertiesChanged: {emitValue: false}, getter: (): string => state.mode, setter: (value: string): string => state.mode = value}))
        service = new LocalService(SERVICE_NAME)
        service.addObject(object)
        await withTimeout(service.run({busAddress: bus.address}), 3000, 'start service')
        client = await withTimeout(DBus.connect({busAddress: bus.address}), 3000, 'connect')
        properties = await withTimeout(client.getInterface(SERVICE_NAME, PATH, 'org.freedesktop.DBus.Properties'), 2000, 'get Properties')
    })

    // Guarded so that a failure in before() still stops the daemon instead of keeping the process alive
    after(async (): Promise<void> => {
        if (service?.dbus) await withTimeout(service.stop(), 2000, 'stop service').catch((): void => undefined)
        if (client) await withTimeout(client.disconnect(), 2000, 'disconnect').catch((): void => undefined)
        if (bus) await bus.stop()
    })

    // Variant arguments are given as plain values: passing a DBusSignedValue for the variant of Set hits a known
    // encoding defect (covered by the interop tests) that makes the daemon drop the connection
    function call(method: string, ...args: any[]): Promise<any> {
        return withTimeout(properties.method[method](...args), 2000, method)
    }

    describe('org.freedesktop.DBus.Properties', (): void => {
        it('gets a property', async (): Promise<void> => {
            assert.equal(await call('Get', INTERFACE, 'Count'), 7)
        })

        it('rejects getting an unknown property', async (): Promise<void> => {
            await assert.rejects(call('Get', INTERFACE, 'Missing'), {name: 'org.freedesktop.DBus.Error.UnknownProperty'})
        })

        it('rejects getting a property of an unknown interface', async (): Promise<void> => {
            await assert.rejects(call('Get', 'org.example.Missing', 'Count'), {name: 'org.freedesktop.DBus.Error.UnknownInterface'})
        })

        it('gets all properties of the interface', async (): Promise<void> => {
            assert.deepEqual(await call('GetAll', INTERFACE), {Name: state.name, Count: 7, Delayed: state.delayed, Mode: state.mode})
        })

        it('sets a property', async (): Promise<void> => {
            await call('Set', INTERFACE, 'Name', 'changed')
            assert.equal(state.name, 'changed')
        })

        it('rejects setting a read-only property', async (): Promise<void> => {
            await assert.rejects(call('Set', INTERFACE, 'Count', 8), {name: 'org.freedesktop.DBus.Error.PropertyReadOnly'})
        })

        it('rejects setting a value of the wrong type', async (): Promise<void> => {
            await assert.rejects(call('Set', INTERFACE, 'Name', {not: 'a string'}), {name: 'org.freedesktop.DBus.Error.InvalidArgs'})
            assert.equal(state.name, 'changed')
        })

        it('announces a changed value with PropertiesChanged', async (): Promise<void> => {
            const changed: Promise<any[]> = nextEvent(properties.signal, 'PropertiesChanged')
            await withTimeout(client.listNames(), 2000, 'sync')
            await call('Set', INTERFACE, 'Name', 'announced')
            assert.deepEqual(await changed, [INTERFACE, {Name: 'announced'}, []])
        })

        it('announces the value of an asynchronous setter once it has completed', async (): Promise<void> => {
            const changed: Promise<any[]> = nextEvent(properties.signal, 'PropertiesChanged')
            await withTimeout(client.listNames(), 2000, 'sync')
            await call('Set', INTERFACE, 'Delayed', 'later')
            assert.equal(state.delayed, 'later', 'Set answered before the setter completed')
            assert.deepEqual(await changed, [INTERFACE, {Delayed: 'later'}, []])
        })

        it('announces an invalidated property without its value', async (): Promise<void> => {
            const changed: Promise<any[]> = nextEvent(properties.signal, 'PropertiesChanged')
            await withTimeout(client.listNames(), 2000, 'sync')
            await call('Set', INTERFACE, 'Mode', 'manual')
            assert.deepEqual(await changed, [INTERFACE, {}, ['Mode']])
        })

        it('answers gdbus with a well-formed Get reply', {skip: !gdbusCliAvailable && 'gdbus not found'}, async (): Promise<void> => {
            assert.equal(await gdbusCall(bus.address, SERVICE_NAME, PATH, 'org.freedesktop.DBus.Properties.Get', [`'${INTERFACE}'`, '\'Count\'']), '(<uint32 7>,)')
        })
    })

    describe('write-only properties', (): void => {
        /**
         * Runs a check against a separate service exposing a write-only property next to a readable one.
         */
        async function withWriteOnlyService(check: (writeOnly: DBusInterface, written: { secret: string }) => Promise<void>): Promise<void> {
            const written: { secret: string } = {secret: ''}
            const object: LocalObject = new LocalObject(PATH)
            object.addInterface(new LocalInterface(INTERFACE)
                .defineProperty({name: 'Visible', type: 's', getter: (): string => 'shown'})
                .defineProperty({name: 'Secret', type: 's', emitPropertiesChanged: true, setter: (value: string): string => written.secret = value}))
            const writeOnlyService: LocalService = new LocalService('org.example.WriteOnly')
            writeOnlyService.addObject(object)
            await withTimeout(writeOnlyService.run({busAddress: bus.address}), 3000, 'start service')
            try {
                await check(await withTimeout(client.getInterface('org.example.WriteOnly', PATH, 'org.freedesktop.DBus.Properties'), 2000, 'get Properties'), written)
            } finally {
                await withTimeout(writeOnlyService.stop(), 2000, 'stop service').catch((): void => undefined)
            }
        }

        it('sets a write-only property', async (): Promise<void> => {
            await withWriteOnlyService(async (writeOnly: DBusInterface, written: { secret: string }): Promise<void> => {
                await withTimeout(writeOnly.method.Set(INTERFACE, 'Secret', 'hidden'), 2000, 'Set')
                assert.equal(written.secret, 'hidden')
            })
        })

        it('rejects getting a write-only property', async (): Promise<void> => {
            await withWriteOnlyService(async (writeOnly: DBusInterface): Promise<void> => {
                await assert.rejects(withTimeout(writeOnly.method.Get(INTERFACE, 'Secret'), 2000, 'Get'), {name: /^org\.freedesktop\.DBus\.Error\./})
            })
        })

        it('announces a changed write-only property as invalidated', async (): Promise<void> => {
            await withWriteOnlyService(async (writeOnly: DBusInterface): Promise<void> => {
                const changed: Promise<any[]> = nextEvent(writeOnly.signal, 'PropertiesChanged')
                await withTimeout(client.listNames(), 2000, 'sync')
                await withTimeout(writeOnly.method.Set(INTERFACE, 'Secret', 'announced'), 2000, 'Set')
                assert.deepEqual(await changed, [INTERFACE, {}, ['Secret']])
            })
        })

        it('leaves write-only properties out of GetAll', async (): Promise<void> => {
            await withWriteOnlyService(async (writeOnly: DBusInterface): Promise<void> => {
                assert.deepEqual(await withTimeout(writeOnly.method.GetAll(INTERFACE), 2000, 'GetAll'), {Visible: 'shown'})
            })
        })
    })

    describe('org.freedesktop.DBus.Peer', (): void => {
        it('answers Ping', async (): Promise<void> => {
            assert.deepEqual(await withTimeout(client.invoke({service: SERVICE_NAME, objectPath: PATH, interface: 'org.freedesktop.DBus.Peer', method: 'Ping'}), 2000, 'Ping'), [])
        })

        it('answers Ping from gdbus', {skip: !gdbusCliAvailable && 'gdbus not found'}, async (): Promise<void> => {
            assert.equal(await gdbusCall(bus.address, SERVICE_NAME, PATH, 'org.freedesktop.DBus.Peer.Ping', []), '()')
        })

        it('returns a machine id', async (): Promise<void> => {
            const [machineId] = await withTimeout(client.invoke({service: SERVICE_NAME, objectPath: PATH, interface: 'org.freedesktop.DBus.Peer', method: 'GetMachineId'}), 2000, 'GetMachineId')
            assert.equal(typeof machineId, 'string')
            assert.ok(machineId.length > 0)
        })
    })
})
