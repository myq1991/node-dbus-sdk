import {after, afterEach, before, beforeEach, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBus} from '../../DBus'
import {DBusInterface} from '../../DBusInterface'
import {DBusSignalEmitter} from '../../lib/DBusSignalEmitter'
import {DBusSignedValue} from '../../lib/DBusSignedValue'
import {PrivateBus} from '../helpers/PrivateBus'
import {createTestService, TEST_INTERFACE, TEST_OBJECT_PATH, TestService} from '../helpers/TestService'
import {dbusSend, nextEvent, withTimeout} from '../helpers/Async'
import {knownBug} from '../helpers/KnownBug'
import {LibdbusMessages} from '../fixtures/LibdbusMessages'

/**
 * Interoperability with libdbus (dbus-send) through a real dbus-daemon, which validates every message it routes.
 * Each test gets a fresh service and client, because a malformed message makes the daemon drop the sender's connection.
 */
describe('interoperability with libdbus', {skip: !PrivateBus.available && 'dbus-daemon not found', timeout: 30000}, (): void => {
    let bus: PrivateBus
    let serviceName: string
    let server: TestService
    let client: DBus
    let counter: number = 0

    before(async (): Promise<void> => {
        bus = await PrivateBus.start()
    })

    after(async (): Promise<void> => {
        await bus.stop()
    })

    beforeEach(async (): Promise<void> => {
        serviceName = `org.example.Interop${++counter}`
        server = createTestService(serviceName)
        await withTimeout(server.service.run({busAddress: bus.address}), 5000, 'start service')
        client = await withTimeout(DBus.connect({busAddress: bus.address}), 5000, 'connect client')
    })

    afterEach(async (): Promise<void> => {
        await withTimeout(server.service.stop(), 2000, 'stop service').catch((): void => undefined)
        await withTimeout(client.disconnect(), 2000, 'disconnect client').catch((): void => undefined)
    })

    function call(method: string, ...args: string[]): Promise<string> {
        return dbusSend(bus.address, ['--print-reply', `--dest=${serviceName}`, TEST_OBJECT_PATH, `${TEST_INTERFACE}.${method}`, ...args])
    }

    describe('libdbus client calling LocalService', (): void => {
        it('passes basic arguments', async (): Promise<void> => {
            assert.match(await call('Add', 'int32:2', 'int32:3'), /int32 5/)
        })

        it('passes a variant', async (): Promise<void> => {
            assert.match(await call('EchoVariant', 'variant:int64:7'), /variant\s+int64 7/)
        })

        it('passes a byte array', async (): Promise<void> => {
            assert.match(await call('EchoBytes', 'array:byte:1,2,3'), /array of bytes \[\s*01 02 03\s*\]/)
        })

        it('reads a property through org.freedesktop.DBus.Properties', async (): Promise<void> => {
            const reply: string = await dbusSend(bus.address, ['--print-reply', `--dest=${serviceName}`, TEST_OBJECT_PATH, 'org.freedesktop.DBus.Properties.Get', `string:${TEST_INTERFACE}`, 'string:Version'])
            assert.match(reply, /variant\s+uint32 3/)
        })

        it('passes an int64 array', knownBug('array content of 8-byte aligned element types is not padded to 8 after the length field'), async (): Promise<void> => {
            const reply: string = await call('EchoInt64Array', 'array:int64:1,2')
            assert.match(reply, /int64 1\s+int64 2/)
        })
    })

    describe('library client through the validating daemon', (): void => {
        it('sends an int64 array', knownBug('array content of 8-byte aligned element types is not padded to 8 after the length field'), async (): Promise<void> => {
            const iface: DBusInterface = await withTimeout(client.getInterface(serviceName, TEST_OBJECT_PATH, TEST_INTERFACE), 2000, 'get interface')
            assert.deepEqual(await withTimeout(iface.method.EchoInt64Array([1n, 2n]), 2000, 'EchoInt64Array'), [1n, 2n])
        })
    })

    describe('library client passing explicit variant values', (): void => {
        it('sets a property passing a DBusSignedValue for the variant argument', knownBug('a DBusSignedValue passed for a top-level variant in a multi-argument signature is written without the variant signature'), async (): Promise<void> => {
            await withTimeout(client.invoke({
                service: serviceName,
                objectPath: TEST_OBJECT_PATH,
                interface: 'org.freedesktop.DBus.Properties',
                method: 'Set',
                signature: 'ssv',
                args: [TEST_INTERFACE, 'Label', new DBusSignedValue('s', 'explicit')]
            }), 2000, 'Properties.Set')
            assert.equal(server.state.label, 'explicit')
        })

        it('sets a property passing a plain value for the variant argument', async (): Promise<void> => {
            await withTimeout(client.invoke({
                service: serviceName,
                objectPath: TEST_OBJECT_PATH,
                interface: 'org.freedesktop.DBus.Properties',
                method: 'Set',
                signature: 'ssv',
                args: [TEST_INTERFACE, 'Label', 'inferred']
            }), 2000, 'Properties.Set')
            assert.equal(server.state.label, 'inferred')
        })
    })

    describe('signals sent by libdbus', (): void => {
        it('decodes basic types', async (): Promise<void> => {
            const emitter: DBusSignalEmitter = client.createSignalEmitter({service: '*', uniqueName: '*', objectPath: '/test', interface: 'test.Golden'})
            const received: Promise<any[]> = nextEvent(emitter, 'Basic')
            await withTimeout(client.listNames(), 2000, 'sync')
            await dbusSend(bus.address, ['--type=signal', '/test', 'test.Golden.Basic', 'byte:1', 'boolean:true', 'int16:-2', 'uint16:3', 'int32:-4', 'uint32:5', 'int64:-6', 'uint64:7', 'double:1.5', 'string:hello', 'objpath:/a/b'])
            assert.deepEqual(await received, LibdbusMessages[0].body)
        })
    })
})
