import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {DBus} from '../../DBus'
import {DBusInterface} from '../../DBusInterface'
import {DBusObject} from '../../DBusObject'
import {AccessPropertyForbiddenError} from '../../lib/Errors'
import {DBusVariant} from '../../lib/datatypes/DBusVariant'
import {DBusUint32} from '../../lib/datatypes/DBusUint32'
import {IntrospectInterface} from '../../types/IntrospectInterface'
import {PrivateBus} from '../helpers/PrivateBus'
import {createTestService, TEST_INTERFACE, TEST_OBJECT_PATH, TestService} from '../helpers/TestService'
import {catchUnhandledRejections, nextEvent, withTimeout} from '../helpers/Async'
import {knownBug} from '../helpers/KnownBug'

const SERVICE_NAME: string = 'org.example.ClientServer'

describe('client and LocalService over dbus-daemon', {skip: !PrivateBus.available && 'dbus-daemon not found', timeout: 30000}, (): void => {
    let bus: PrivateBus
    let server: TestService
    let client: DBus
    let iface: DBusInterface

    before(async (): Promise<void> => {
        bus = await PrivateBus.start()
        server = createTestService(SERVICE_NAME)
        await withTimeout(server.service.run({busAddress: bus.address}), 5000, 'start service')
        client = await withTimeout(DBus.connect({busAddress: bus.address}), 5000, 'connect client')
        iface = await withTimeout(client.getInterface(SERVICE_NAME, TEST_OBJECT_PATH, TEST_INTERFACE), 5000, 'get interface')
    })

    after(async (): Promise<void> => {
        await withTimeout(server.service.stop(), 2000, 'stop service').catch((): void => undefined)
        await withTimeout(client.disconnect(), 2000, 'disconnect client').catch((): void => undefined)
        await bus.stop()
    })

    /**
     * A round trip through the daemon guarantees that earlier no-reply messages (e.g. AddMatch) were processed.
     */
    async function sync(): Promise<void> {
        await withTimeout(client.listNames(), 2000, 'sync')
    }

    describe('discovery', (): void => {
        it('lists the service', async (): Promise<void> => {
            const names: string[] = (await client.listServices()).map((service): string => service.name)
            assert.ok(names.includes(SERVICE_NAME))
        })

        it('introspects the object including the standard interfaces', async (): Promise<void> => {
            const object: DBusObject = await client.getObject(SERVICE_NAME, TEST_OBJECT_PATH)
            const names: string[] = (await object.introspect()).interface.map((introspected: IntrospectInterface): string => introspected.name)
            for (const expected of [TEST_INTERFACE, 'org.freedesktop.DBus.Properties', 'org.freedesktop.DBus.Introspectable', 'org.freedesktop.DBus.Peer']) {
                assert.ok(names.includes(expected), `missing ${expected} in ${names.join(', ')}`)
            }
        })

        it('lists methods from introspection', (): void => {
            assert.deepEqual(iface.listMethods().map((method): string => method.name).sort(), ['Add', 'DivMod', 'EchoBytes', 'EchoDict', 'EchoInt64Array', 'EchoVariant', 'Fail', 'TypedUint32', 'TypedVariant'])
        })
    })

    describe('methods', (): void => {
        it('calls with positional arguments', async (): Promise<void> => {
            assert.equal(await withTimeout(iface.method.Add(2, 3), 2000, 'Add'), 5)
        })

        it('calls with named arguments', async (): Promise<void> => {
            assert.equal(await withTimeout(iface.parameterObjectifyMethod.Add({b: 3, a: 2}), 2000, 'Add'), 5)
        })

        for (const value of ['text', 42, 1.5, true]) {
            it(`round-trips the variant ${JSON.stringify(value)}`, async (): Promise<void> => {
                assert.equal(await withTimeout(iface.method.EchoVariant(value), 2000, 'EchoVariant'), value)
            })
        }

        it('round-trips nested dictionaries', async (): Promise<void> => {
            const value: Record<string, any> = {name: 'x', count: 2, big: 5n, tags: ['a', 'b'], nested: {key: 'value'}}
            assert.deepEqual(await withTimeout(iface.method.EchoDict(value), 2000, 'EchoDict'), value)
        })

        it('round-trips byte arrays', async (): Promise<void> => {
            const value: Buffer = randomBytes(4096)
            assert.deepEqual(await withTimeout(iface.method.EchoBytes(value), 5000, 'EchoBytes'), value)
        })

        it('returns several output arguments', async (): Promise<void> => {
            assert.deepEqual(await withTimeout(iface.method.DivMod(17, 5), 2000, 'DivMod'), [3, 2])
        })

        it('returns a DBusTypeClass result', async (): Promise<void> => {
            assert.equal(await withTimeout(iface.method.TypedUint32(), 2000, 'TypedUint32'), 4000000000)
        })

        // Plain decoding unwraps nested variants, which would hide the extra wrapper, so inspect the typed reply
        it('returns a DBusVariant result', async (): Promise<void> => {
            const typedClient: DBus = await withTimeout(DBus.connect({busAddress: bus.address, advancedResponse: true}), 5000, 'connect typed client')
            try {
                const [variant] = await withTimeout(typedClient.invoke({service: SERVICE_NAME, objectPath: TEST_OBJECT_PATH, interface: TEST_INTERFACE, method: 'TypedVariant'}), 2000, 'TypedVariant')
                assert.ok(variant instanceof DBusVariant)
                assert.ok(variant.$value instanceof DBusUint32, `variant holds ${variant.$value?.constructor?.name}`)
                assert.equal(variant.$value.value, 7)
            } finally {
                await withTimeout(typedClient.disconnect(), 2000, 'disconnect typed client').catch((): void => undefined)
            }
        })

        it('propagates DBus errors thrown by the handler', async (): Promise<void> => {
            await assert.rejects(withTimeout(iface.method.Fail(), 2000, 'Fail'), {name: 'org.example.Error.Boom', message: 'boom'})
        })

        it('reports unknown methods', async (): Promise<void> => {
            await assert.rejects(withTimeout(client.invoke({service: SERVICE_NAME, objectPath: TEST_OBJECT_PATH, interface: TEST_INTERFACE, method: 'Missing'}), 2000, 'Missing'), {name: 'org.freedesktop.DBus.Error.UnknownMethod'})
        })

        it('reports unknown objects', async (): Promise<void> => {
            await assert.rejects(withTimeout(client.invoke({service: SERVICE_NAME, objectPath: '/missing', interface: TEST_INTERFACE, method: 'Add'}), 2000, 'unknown object'), {name: 'org.freedesktop.DBus.Error.UnknownObject'})
        })

        it('explains which object is unknown', async (): Promise<void> => {
            await assert.rejects(withTimeout(client.invoke({service: SERVICE_NAME, objectPath: '/missing', interface: TEST_INTERFACE, method: 'Add'}), 2000, 'unknown object'), {message: /\/missing/})
        })
    })

    describe('properties', (): void => {
        it('reads a read-only property', async (): Promise<void> => {
            assert.equal(await withTimeout(iface.property.Version.get(), 2000, 'get Version'), 3)
        })

        it('refuses to write a read-only property', async (): Promise<void> => {
            await assert.rejects(iface.property.Version.set(4), AccessPropertyForbiddenError)
        })

        it('writes and reads a property', async (): Promise<void> => {
            await withTimeout(iface.property.Label.set('changed'), 2000, 'set Label')
            assert.equal(server.state.label, 'changed')
            assert.equal(await withTimeout(iface.property.Label.get(), 2000, 'get Label'), 'changed')
        })

        it('writes a property that does not emit PropertiesChanged', async (): Promise<void> => {
            await withTimeout(iface.property.Plain.set('changed'), 2000, 'set Plain')
            assert.equal(server.state.plain, 'changed')
        })

        // Uses its own service: the test runner attributes an unhandled rejection to the hook or test that created
        // the service's connection, and it must land on this test rather than on the shared before() hook.
        it('returns a validation error from an asynchronous setter to the caller', async (): Promise<void> => {
            const validating: TestService = createTestService('org.example.Validating')
            await withTimeout(validating.service.run({busAddress: bus.address}), 5000, 'start validating service')
            try {
                const target: DBusInterface = await withTimeout(client.getInterface('org.example.Validating', TEST_OBJECT_PATH, TEST_INTERFACE), 2000, 'get interface')
                const {result, unhandled} = await catchUnhandledRejections((): Promise<void> => withTimeout(target.property.Checked.set('invalid'), 2000, 'set Checked'))
                assert.deepEqual(unhandled, [], 'the service would have crashed')
                assert.equal(result.status, 'rejected')
                assert.equal((result as PromiseRejectedResult).reason.name, 'org.example.Error.Invalid')
                assert.equal((result as PromiseRejectedResult).reason.message, 'value rejected by validation')
                assert.equal(validating.state.checked, 'initial')
            } finally {
                await withTimeout(validating.service.stop(), 2000, 'stop validating service').catch((): void => undefined)
            }
        })

        it('emits PropertiesChanged with the new value', async (): Promise<void> => {
            const properties: DBusInterface = await client.getInterface(SERVICE_NAME, TEST_OBJECT_PATH, 'org.freedesktop.DBus.Properties')
            const changed: Promise<any[]> = nextEvent(properties.signal, 'PropertiesChanged')
            await sync()
            await withTimeout(iface.property.Label.set('notified'), 2000, 'set Label')
            assert.deepEqual(await changed, [TEST_INTERFACE, {Label: 'notified'}, []])
        })
    })

    describe('signals', (): void => {
        it('delivers signals emitted by the service', async (): Promise<void> => {
            const tick: Promise<any[]> = nextEvent(iface.signal, 'Tick')
            await sync()
            server.signals.emit('Tick', 7)
            assert.deepEqual(await tick, [7])
        })
    })

    describe('name ownership', (): void => {
        /**
         * Resolves when the event fires for the given bus name; unique connection names (":1.x") fire it too.
         */
        function nameEvent(eventName: 'online' | 'offline', busName: string): Promise<void> {
            return withTimeout(new Promise<void>((resolve): void => {
                const listener = (name: string): void => {
                    if (name !== busName) return
                    client.off(eventName, listener)
                    resolve()
                }
                client.on(eventName, listener)
            }), 3000, `${eventName} ${busName}`)
        }

        it('emits online and offline when a service starts and stops', async (): Promise<void> => {
            const other: TestService = createTestService('org.example.Transient')
            const online: Promise<void> = nameEvent('online', 'org.example.Transient')
            await withTimeout(other.service.run({busAddress: bus.address}), 5000, 'start transient service')
            await online
            const offline: Promise<void> = nameEvent('offline', 'org.example.Transient')
            await withTimeout(other.service.stop(), 5000, 'stop transient service')
            await offline
        })
    })
})
