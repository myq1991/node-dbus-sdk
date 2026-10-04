import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBus} from '../../DBus'
import {DBusInterface} from '../../DBusInterface'
import {PrivateBus} from '../helpers/PrivateBus'
import {createTestService, TEST_INTERFACE, TEST_OBJECT_PATH, TestService} from '../helpers/TestService'
import {catchUnhandledRejections, withTimeout} from '../helpers/Async'

let nameCounter: number = 0

/**
 * Stopping a LocalService while calls are being handled, immediately and gracefully, through dbus-daemon.
 */
describe('stopping a LocalService', {skip: !PrivateBus.available && 'dbus-daemon not found', timeout: 30000}, (): void => {
    let bus: PrivateBus
    let client: DBus

    before(async (): Promise<void> => {
        bus = await PrivateBus.start()
        client = await withTimeout(DBus.connect({busAddress: bus.address}), 3000, 'connect')
    })

    after(async (): Promise<void> => {
        if (client) await withTimeout(client.disconnect(), 2000, 'disconnect').catch((): void => undefined)
        if (bus) await bus.stop()
    })

    async function runningService(): Promise<{ server: TestService, name: string, iface: DBusInterface }> {
        const name: string = `org.example.Stopping${++nameCounter}`
        const server: TestService = createTestService(name)
        await withTimeout(server.service.run({busAddress: bus.address}), 3000, 'run')
        const iface: DBusInterface = await withTimeout(client.getInterface(name, TEST_OBJECT_PATH, TEST_INTERFACE), 2000, 'get interface')
        return {server, name, iface}
    }

    /**
     * Resolves once the service has started handling a Sleep call.
     */
    async function handling(server: TestService): Promise<void> {
        await withTimeout((async (): Promise<void> => {
            while (!server.state.sleeping) await new Promise<void>((resolve): NodeJS.Timeout => setTimeout(resolve, 5))
        })(), 2000, 'call reaching the service')
    }

    it('lets calls in progress finish, refuses new ones, then releases the name', async (): Promise<void> => {
        const {server, name, iface} = await runningService()
        const slow: Promise<number> = iface.method.Sleep(300)
        await handling(server)
        const stopped: Promise<void> = server.service.stop({graceful: true})
        await assert.rejects(withTimeout(iface.method.Add(1, 2), 2000, 'Add during stop'), {name: 'org.freedesktop.DBus.Error.ServiceUnknown'})
        assert.equal(await withTimeout(slow, 2000, 'Sleep'), 300)
        await withTimeout(stopped, 2000, 'graceful stop')
        assert.equal(await client.nameHasOwner(name), false)
    })

    it('stops waiting for calls in progress after the timeout', async (): Promise<void> => {
        const {server, iface} = await runningService()
        const slow: Promise<number> = iface.method.Sleep(5000)
        slow.catch((): void => undefined)
        await handling(server)
        const started: number = Date.now()
        await withTimeout(server.service.stop({graceful: true, timeout: 200}), 3000, 'graceful stop')
        const elapsed: number = Date.now() - started
        assert.ok(elapsed >= 190 && elapsed < 2000, `stop took ${elapsed} ms`)
        await assert.rejects(withTimeout(slow, 2000, 'Sleep'))
    })

    it('can run again after a graceful stop', async (): Promise<void> => {
        const {server, name} = await runningService()
        await withTimeout(server.service.stop({graceful: true}), 2000, 'graceful stop')
        await withTimeout(server.service.run({busAddress: bus.address}), 3000, 'run again')
        try {
            const iface: DBusInterface = await withTimeout(client.getInterface(name, TEST_OBJECT_PATH, TEST_INTERFACE), 2000, 'get interface')
            assert.equal(await withTimeout(iface.method.Add(1, 2), 2000, 'Add'), 3)
        } finally {
            await withTimeout(server.service.stop(), 2000, 'stop').catch((): void => undefined)
        }
    })

    it('does not crash the process when stopped immediately while a call is in progress', async (): Promise<void> => {
        const {server, iface} = await runningService()
        const slow: Promise<number> = iface.method.Sleep(200)
        slow.catch((): void => undefined)
        await handling(server)
        const {unhandled} = await catchUnhandledRejections(async (): Promise<void> => {
            await withTimeout(server.service.stop(), 2000, 'immediate stop')
            // The handler finishes after the connection closed and tries to reply
            await new Promise<void>((resolve): NodeJS.Timeout => setTimeout(resolve, 400))
        })
        assert.deepEqual(unhandled, [])
        await assert.rejects(withTimeout(slow, 2000, 'Sleep'))
    })
})
