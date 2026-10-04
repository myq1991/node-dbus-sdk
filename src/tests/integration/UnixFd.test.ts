import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBus} from '../../DBus'
import {PrivateBus} from '../helpers/PrivateBus'
import {GDBusEchoService, pygobjectAvailable} from '../helpers/GDBus'
import {loadWireMatrix, WireMatrix} from '../helpers/TaggedValue'
import {withTimeout} from '../helpers/Async'
import {knownBug} from '../helpers/KnownBug'

const matrix: WireMatrix = loadWireMatrix()

/**
 * UNIX_FD ('h') values are indexes into file descriptors sent alongside the message (SCM_RIGHTS), which requires
 * negotiating NEGOTIATE_UNIX_FD during authentication. Node's net sockets cannot pass descriptors, so the library
 * cannot support them; these tests pin down that it fails clearly instead of misbehaving.
 */
describe('UNIX_FD values over a real bus', {skip: (!PrivateBus.available && 'dbus-daemon not found') || (!pygobjectAvailable && 'python3 with PyGObject not found'), timeout: 30000}, (): void => {
    let bus: PrivateBus
    let echo: GDBusEchoService

    before(async (): Promise<void> => {
        bus = await PrivateBus.start()
        echo = await GDBusEchoService.start(bus.address)
    })

    after(async (): Promise<void> => {
        await echo.stop()
        await bus.stop()
    })

    async function withClient(operation: (client: DBus) => Promise<void>): Promise<void> {
        const client: DBus = await withTimeout(DBus.connect({busAddress: bus.address}), 3000, 'connect')
        try {
            await operation(client)
        } finally {
            await withTimeout(client.disconnect(), 1000, 'disconnect').catch((): void => undefined)
        }
    }

    it('fails a call whose reply carries a file descriptor instead of waiting forever', knownBug('file descriptor passing is not negotiated and calls have no reply timeout, so the bus drops the reply and the call never settles'), async (): Promise<void> => {
        await withClient(async (client: DBus): Promise<void> => {
            const call: Promise<any[]> = client.invoke({service: GDBusEchoService.SERVICE_NAME, objectPath: GDBusEchoService.OBJECT_PATH, interface: GDBusEchoService.INTERFACE, method: 'GetFd'})
            await assert.rejects(withTimeout(call, 3000, 'GetFd'), (error: Error): boolean => !error.message.startsWith('Timed out'))
        })
    })

    it('refuses to send a UNIX_FD value it cannot attach a file descriptor for', knownBug('UNIX_FD values are sent as bare indexes without any file descriptor attached'), async (): Promise<void> => {
        await withClient(async (client: DBus): Promise<void> => {
            const call: Promise<any[]> = client.invoke({service: GDBusEchoService.SERVICE_NAME, objectPath: GDBusEchoService.OBJECT_PATH, interface: GDBusEchoService.INTERFACE, method: matrix.echoMethods.h, signature: 'h', args: [0]})
            await assert.rejects(withTimeout(call, 3000, 'echo h'))
        })
    })
})
