import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import EventEmitter from 'node:events'
import {DBus} from '../../DBus'
import {DBusInterface} from '../../DBusInterface'
import {DBusObjectManager} from '../../DBusObjectManager'
import {LocalService} from '../../LocalService'
import {LocalObject} from '../../LocalObject'
import {LocalInterface} from '../../LocalInterface'
import {DBusSignedValue} from '../../lib/DBusSignedValue'
import {DBusUInt32} from '../../lib/datatypes/DBusUInt32'
import {DBusUInt64} from '../../lib/datatypes/DBusUInt64'
import {DBusObjectPath} from '../../lib/datatypes/DBusObjectPath'
import {DBusArray} from '../../lib/datatypes/DBusArray'
import {DBusDictEntry} from '../../lib/datatypes/DBusDictEntry'
import {DBusVariant} from '../../lib/datatypes/DBusVariant'
import {MethodCallContext} from '../../types/MethodCallContext'
import {PrivateBus} from '../helpers/PrivateBus'
import {nextEvent, withTimeout} from '../helpers/Async'

const SERVICE: string = 'org.example.Settings'
const PATH: string = '/org/example/Settings'
const IFACE: string = 'org.example.Settings1'

/**
 * Settings in the shape NetworkManager uses (a{sa{sv}}), with types that plain values would not be inferred as.
 */
function settings(): Record<string, Record<string, DBusSignedValue>> {
    return {
        connection: {id: new DBusSignedValue('s', 'wired'), timestamp: new DBusUInt64(1700000000n)},
        ethernet: {mtu: new DBusUInt32(1500), mac: new DBusSignedValue('ay', Buffer.from([0, 17, 34]))},
        ipv4: {dns: new DBusSignedValue('au', []), gateway: new DBusObjectPath('/org/example/gw'), metric: new DBusSignedValue('d', 1)}
    }
}

/**
 * The signature of every variant in a{sa{sv}} settings as received: {group: {key: signature}}.
 */
function variantSignatures(context: MethodCallContext): Record<string, Record<string, string>> {
    const [dictionary] = context.message.getBody({types: 'all'}) as [DBusArray<DBusDictEntry>]
    const result: Record<string, Record<string, string>> = {}
    for (const group of dictionary.items) {
        result[group.key.value] = {}
        for (const entry of (group.content as DBusArray<DBusDictEntry>).items) result[group.key.value][entry.key.value] = (entry.content as DBusVariant).content.signature
    }
    return result
}

const ORIGINAL: Record<string, Record<string, string>> = {
    connection: {id: 's', timestamp: 't'},
    ethernet: {mtu: 'u', mac: 'ay'},
    ipv4: {dns: 'au', gateway: 'o', metric: 'd'}
}

/**
 * Received values sent back through dbus-daemon, and DecodeOpts on every path a value is received through.
 */
describe('typed values through the bus', {skip: !PrivateBus.available && 'dbus-daemon not found', timeout: 30000}, (): void => {
    let bus: PrivateBus
    let service: LocalService
    let client: DBus
    let level: number = 7
    const events: EventEmitter = new EventEmitter()

    before(async (): Promise<void> => {
        bus = await PrivateBus.start()
        const iface: LocalInterface = new LocalInterface(IFACE)
            .defineMethod({name: 'GetSettings', outputArgs: [{type: 'a{sa{sv}}'}], method: settings})
            .defineMethod({name: 'Update', inputArgs: [{type: 'a{sa{sv}}'}], outputArgs: [{type: 'a{sa{sv}}'}], withContext: true, method: (_settings: unknown, context: MethodCallContext) => variantSignatures(context)})
            .defineMethod({name: 'Get', outputArgs: [{type: 'v'}], method: (): DBusSignedValue => new DBusUInt32(7)})
            .defineMethod({name: 'Describe', inputArgs: [{type: 'v'}], outputArgs: [{type: 's'}], withContext: true, method: (_value: unknown, context: MethodCallContext): string => (context.message.getBody({types: 'all'})[0] as DBusVariant).content.signature})
            .defineMethod({name: 'Big', outputArgs: [{type: 't'}], method: (): bigint => 42n})
            .defineProperty({name: 'Level', type: 'v', emitPropertiesChanged: true, getter: (): DBusSignedValue => new DBusUInt32(level), setter: (value: number): void => {
                level = value
            }})
            .defineSignal({name: 'Changed', args: [{type: 'a{sv}'}], eventEmitter: events})
        const object: LocalObject = new LocalObject(PATH)
        object.addInterface(iface)
        service = new LocalService(SERVICE)
        service.addObject(object)
        await withTimeout(service.run({busAddress: bus.address}), 3000, 'start service')
        client = await withTimeout(DBus.connect({busAddress: bus.address}), 3000, 'connect')
    })

    after(async (): Promise<void> => {
        await withTimeout(service.stop(), 2000, 'stop').catch((): void => undefined)
        await withTimeout(client.disconnect(), 2000, 'disconnect').catch((): void => undefined)
        await bus.stop()
    })

    describe('settings read and written back, as with NetworkManager', (): void => {
        it('keep every type when changed in place, with plain values', async (): Promise<void> => {
            const proxy: DBusInterface = await client.getInterface(SERVICE, PATH, IFACE)
            const current = await proxy.method.GetSettings()
            assert.equal(current.ethernet.mtu, 1500)
            current.ethernet.mtu = 9000
            current.connection.id = 'renamed'
            assert.deepEqual(await proxy.method.Update(current), ORIGINAL)
        })

        it('fall back to inferred types in an object copied by spreading, with plain values', async (): Promise<void> => {
            const proxy: DBusInterface = await client.getInterface(SERVICE, PATH, IFACE)
            const current = await proxy.method.GetSettings()
            const received = await proxy.method.Update({...current, ethernet: {...current.ethernet, mtu: 9000}})
            assert.deepEqual(received.ethernet, {mtu: 'i', mac: 'ay'})
            assert.deepEqual(received.ipv4, ORIGINAL.ipv4)
        })

        it('keep every type in copies with types variants', async (): Promise<void> => {
            const proxy: DBusInterface = await client.getInterface(SERVICE, PATH, IFACE, {decode: {types: 'variants'}})
            const current = await proxy.method.GetSettings()
            assert.ok(current.ethernet.mtu instanceof DBusUInt32)
            const changed = {...current, ethernet: {...current.ethernet, mtu: new DBusUInt32(9000)}}
            const received = await proxy.method.Update(changed)
            assert.deepEqual(received.ethernet.mtu.value, 'u')
            assert.deepEqual(Object.fromEntries(Object.entries(received).map(([group, keys]: [string, any]): [string, any] => [group, Object.fromEntries(Object.entries(keys).map(([key, signature]: [string, any]): [string, string] => [key, signature.value]))])), ORIGINAL)
        })
    })

    it('keeps the type of a lone variant when a reply\'s arguments are sent again', async (): Promise<void> => {
        const reply: any[] = await client.invoke({service: SERVICE, objectPath: PATH, interface: IFACE, method: 'Get'})
        assert.deepEqual(reply, [7])
        const [signature] = await client.invoke({service: SERVICE, objectPath: PATH, interface: IFACE, method: 'Describe', signature: 'v', args: reply})
        assert.equal(signature, 'u')
    })

    describe('DecodeOpts', (): void => {
        it('apply per call', async (): Promise<void> => {
            const [typed] = await client.invoke({service: SERVICE, objectPath: PATH, interface: IFACE, method: 'Get', decode: {types: 'all'}})
            assert.ok(typed instanceof DBusVariant && typed.content instanceof DBusUInt32)
            assert.deepEqual(await client.invoke({service: SERVICE, objectPath: PATH, interface: IFACE, method: 'Big', decode: {int64: 'number'}}), [42])
            assert.deepEqual(await client.invoke({service: SERVICE, objectPath: PATH, interface: IFACE, method: 'Big'}), [42n])
        })

        it('apply to properties, read directly or through a proxy', async (): Promise<void> => {
            const value = await client.getProperty({service: SERVICE, objectPath: PATH, interface: IFACE, property: 'Level', decode: {types: 'variants'}})
            assert.ok(value instanceof DBusUInt32)
            const proxy: DBusInterface = await client.getInterface(SERVICE, PATH, IFACE, {decode: {types: 'variants'}})
            assert.ok(await proxy.property.Level.get() instanceof DBusUInt32)
            assert.equal(await (await client.getInterface(SERVICE, PATH, IFACE)).property.Level.get(), 7)
        })

        it('apply to signals per emitter', async (): Promise<void> => {
            const plain: DBusInterface = await client.getInterface(SERVICE, PATH, IFACE)
            const typed: DBusInterface = await client.getInterface(SERVICE, PATH, IFACE, {decode: {types: 'variants', dictionaries: 'map'}})
            const plainSignal: Promise<any[]> = nextEvent(plain.signal, 'Changed')
            const typedSignal: Promise<any[]> = nextEvent(typed.signal, 'Changed')
            await client.listNames()
            events.emit('Changed', {count: new DBusUInt32(3)})
            const [[plainArgs], [typedArgs]] = await Promise.all([plainSignal, typedSignal])
            assert.deepEqual(plainArgs, {count: 3})
            assert.ok(typedArgs instanceof Map && typedArgs.get('count') instanceof DBusUInt32)
        })

        it('set connection defaults, and give a service\'s methods their arguments in that form', async (): Promise<void> => {
            const typedService: LocalService = new LocalService('org.example.TypedArguments')
            let received: unknown
            const object: LocalObject = new LocalObject('/a')
            object.addInterface(new LocalInterface('org.example.Typed1').defineMethod({name: 'Take', inputArgs: [{type: 'v'}], method: (value: unknown): void => {
                received = value
            }}))
            typedService.addObject(object)
            await typedService.run({busAddress: bus.address, decode: {types: 'variants'}})
            const typedClient: DBus = await DBus.connect({busAddress: bus.address, decode: {int64: 'number'}})
            try {
                await typedClient.invoke({service: 'org.example.TypedArguments', objectPath: '/a', interface: 'org.example.Typed1', method: 'Take', signature: 'v', args: [new DBusUInt32(5)]})
                assert.ok(received instanceof DBusUInt32)
                assert.deepEqual(await typedClient.invoke({service: SERVICE, objectPath: PATH, interface: IFACE, method: 'Big'}), [42])
            } finally {
                await typedClient.disconnect()
                await typedService.stop()
            }
        })

        it('apply to the properties an object manager keeps', async (): Promise<void> => {
            const manager: DBusObjectManager = await client.getObjectManager(SERVICE, '/', {decode: {types: 'all', dictionaries: 'map'}})
            try {
                const properties: Record<string, any> | undefined = manager.getProperties(PATH, IFACE)
                assert.ok(properties!.Level instanceof DBusUInt32)
            } finally {
                manager.close()
            }
        })
    })
})
