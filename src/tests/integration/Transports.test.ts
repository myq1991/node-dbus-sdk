import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import {DBus} from '../../DBus'
import {DBusInterface} from '../../DBusInterface'
import {ConnectOpts} from '../../types/ConnectOpts'
import {PrivateBus} from '../helpers/PrivateBus'
import {createTestService, TEST_INTERFACE, TEST_OBJECT_PATH, TestService} from '../helpers/TestService'
import {withTimeout} from '../helpers/Async'
import {knownBug} from '../helpers/KnownBug'

describe('transports', {skip: !PrivateBus.available && 'dbus-daemon not found', timeout: 30000}, (): void => {
    let bus: PrivateBus

    before(async (): Promise<void> => {
        // EXTERNAL is unavailable over TCP and DBUS_COOKIE_SHA1 is broken (see the authentication tests), so TCP
        // connections authenticate with ANONYMOUS to test the transport itself
        bus = await PrivateBus.start({tcp: true, auth: ['EXTERNAL', 'ANONYMOUS']})
    })

    after(async (): Promise<void> => {
        await bus.stop()
    })

    function tcpPort(): number {
        return parseInt(/port=(\d+)/.exec(bus.tcpAddress!)![1])
    }

    /**
     * Connects, checks the connection works with a bus round trip, and disconnects.
     */
    async function assertConnects(opts: () => ConnectOpts): Promise<void> {
        const dbus: DBus = await withTimeout(DBus.connect(opts()), 3000, 'connect')
        try {
            assert.match(dbus.uniqueName, /^:1\.\d+$/)
            assert.ok((await withTimeout(dbus.listNames(), 2000, 'ListNames')).includes(dbus.uniqueName))
        } finally {
            await withTimeout(dbus.disconnect(), 2000, 'disconnect').catch((): void => undefined)
        }
    }

    describe('unix domain socket', (): void => {
        it('connects with a unix: bus address', async (): Promise<void> => {
            await assertConnects((): ConnectOpts => ({busAddress: bus.unixAddress}))
        })

        it('connects with the socket option', async (): Promise<void> => {
            await assertConnects((): ConnectOpts => ({socket: bus.socketPath}))
        })

        it('connects over a caller-supplied stream', async (): Promise<void> => {
            await assertConnects((): ConnectOpts => ({stream: net.createConnection(bus.socketPath)}))
        })

        it('uses DBUS_SESSION_BUS_ADDRESS when no address is given', async (): Promise<void> => {
            const original: string | undefined = process.env.DBUS_SESSION_BUS_ADDRESS
            process.env.DBUS_SESSION_BUS_ADDRESS = bus.unixAddress
            try {
                await assertConnects((): ConnectOpts => ({}))
            } finally {
                if (original === undefined) {
                    delete process.env.DBUS_SESSION_BUS_ADDRESS
                } else {
                    process.env.DBUS_SESSION_BUS_ADDRESS = original
                }
            }
        })
    })

    describe('TCP', (): void => {
        it('connects with a tcp: bus address', async (): Promise<void> => {
            await assertConnects((): ConnectOpts => ({busAddress: bus.tcpAddress}))
        })

        it('connects with the host and port options', async (): Promise<void> => {
            await assertConnects((): ConnectOpts => ({host: '127.0.0.1', port: tcpPort()}))
        })

        it('serves a LocalService to a client over TCP', async (): Promise<void> => {
            const server: TestService = createTestService('org.example.OverTcp')
            await withTimeout(server.service.run({busAddress: bus.tcpAddress}), 3000, 'start service')
            const client: DBus = await withTimeout(DBus.connect({busAddress: bus.tcpAddress}), 3000, 'connect')
            try {
                const iface: DBusInterface = await withTimeout(client.getInterface('org.example.OverTcp', TEST_OBJECT_PATH, TEST_INTERFACE), 2000, 'get interface')
                assert.equal(await withTimeout(iface.method.Add(20, 22), 2000, 'Add'), 42)
            } finally {
                await withTimeout(server.service.stop(), 2000, 'stop service').catch((): void => undefined)
                await withTimeout(client.disconnect(), 2000, 'disconnect').catch((): void => undefined)
            }
        })
    })

    describe('TCP with DBUS_COOKIE_SHA1, the usual configuration of TCP buses', (): void => {
        it('connects', async (): Promise<void> => {
            const cookieBus: PrivateBus = await PrivateBus.start({tcp: true, auth: ['DBUS_COOKIE_SHA1']})
            try {
                const dbus: DBus = await cookieBus.withHome((): Promise<DBus> => withTimeout(DBus.connect({busAddress: cookieBus.tcpAddress}), 3000, 'connect'))
                await withTimeout(dbus.disconnect(), 2000, 'disconnect').catch((): void => undefined)
            } finally {
                await cookieBus.stop()
            }
        })
    })

    describe('address lists and failures', (): void => {
        it('falls back to the next address when the first one fails', knownBug('only the first address of a bus address list is tried'), async (): Promise<void> => {
            await assertConnects((): ConnectOpts => ({busAddress: `unix:path=${bus.socketPath}.missing;${bus.unixAddress}`}))
        })

        it('rejects when nothing listens on the socket', async (): Promise<void> => {
            await assert.rejects(withTimeout(DBus.connect({socket: `${bus.socketPath}.missing`}), 3000, 'connect'), {code: 'ENOENT'})
        })

        it('rejects when nothing listens on the TCP port', async (): Promise<void> => {
            const server: net.Server = net.createServer()
            await new Promise<void>((resolve): net.Server => server.listen(0, '127.0.0.1', resolve))
            const port: number = (server.address() as net.AddressInfo).port
            await new Promise<void>((resolve): net.Server => server.close((): void => resolve()))
            await assert.rejects(withTimeout(DBus.connect({host: '127.0.0.1', port}), 3000, 'connect'), {code: 'ECONNREFUSED'})
        })

        it('rejects an unsupported transport', async (): Promise<void> => {
            await assert.rejects(withTimeout(DBus.connect({busAddress: 'launchd:env=DBUS_LAUNCHD_SESSION_BUS_SOCKET'}), 3000, 'connect'))
        })
    })
})
