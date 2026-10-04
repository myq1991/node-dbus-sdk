import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBus} from '../../DBus'
import {AuthError} from '../../lib/Errors'
import {CreateConnectOpts} from '../../types/CreateConnectOpts'
import {PrivateBus} from '../helpers/PrivateBus'
import {withTimeout} from '../helpers/Async'
import {knownBug} from '../helpers/KnownBug'

const COOKIE_RESPONSE_BUG: string = 'the DBUS_COOKIE_SHA1 response omits the space between client challenge and hash, so the bus rejects it'

/**
 * Connects with the given options against the bus (using its keyring HOME), checks a round trip and disconnects.
 */
async function assertAuthenticates(bus: PrivateBus, opts: CreateConnectOpts): Promise<void> {
    const dbus: DBus = await bus.withHome((): Promise<DBus> => withTimeout(DBus.connect(opts), 3000, 'connect'))
    try {
        assert.match(dbus.uniqueName, /^:1\.\d+$/)
        await withTimeout(dbus.listNames(), 2000, 'ListNames')
    } finally {
        await withTimeout(dbus.disconnect(), 2000, 'disconnect').catch((): void => undefined)
    }
}

describe('authentication', {skip: !PrivateBus.available && 'dbus-daemon not found', timeout: 30000}, (): void => {

    describe('against a bus accepting EXTERNAL, DBUS_COOKIE_SHA1 and ANONYMOUS', (): void => {
        let bus: PrivateBus

        before(async (): Promise<void> => {
            bus = await PrivateBus.start({auth: ['EXTERNAL', 'DBUS_COOKIE_SHA1', 'ANONYMOUS']})
        })

        after(async (): Promise<void> => {
            await bus.stop()
        })

        for (const mechanism of ['EXTERNAL', 'DBUS_COOKIE_SHA1', 'ANONYMOUS']) {
            it(`authenticates with ${mechanism}`, mechanism === 'DBUS_COOKIE_SHA1' ? knownBug(COOKIE_RESPONSE_BUG) : {}, async (): Promise<void> => {
                await assertAuthenticates(bus, {busAddress: bus.unixAddress, authMethods: [mechanism]})
            })
        }
    })

    describe('fallback through the default mechanism order', (): void => {
        for (const accepted of ['DBUS_COOKIE_SHA1', 'ANONYMOUS']) {
            it(`reaches ${accepted} when the bus only accepts it`, accepted === 'DBUS_COOKIE_SHA1' ? knownBug(COOKIE_RESPONSE_BUG) : {}, async (): Promise<void> => {
                const bus: PrivateBus = await PrivateBus.start({auth: [accepted]})
                try {
                    await assertAuthenticates(bus, {busAddress: bus.unixAddress})
                } finally {
                    await bus.stop()
                }
            })
        }
    })

    describe('failures', (): void => {
        let bus: PrivateBus

        before(async (): Promise<void> => {
            bus = await PrivateBus.start({auth: ['EXTERNAL']})
        })

        after(async (): Promise<void> => {
            await bus.stop()
        })

        // DBus.connect() is typed as taking ConnectOpts, which lacks the handshake options it actually honours,
        // so object literals with authMethods do not compile and the options go through a CreateConnectOpts variable
        it('rejects with AuthError when no offered mechanism is accepted', async (): Promise<void> => {
            const opts: CreateConnectOpts = {busAddress: bus.unixAddress, authMethods: ['ANONYMOUS']}
            await assert.rejects(withTimeout(DBus.connect(opts), 3000, 'connect'), AuthError)
        })

        it('rejects an unsupported mechanism name', async (): Promise<void> => {
            const opts: CreateConnectOpts = {busAddress: bus.unixAddress, authMethods: ['KERBEROS_V4']}
            await assert.rejects(withTimeout(DBus.connect(opts), 3000, 'connect'), AuthError)
        })
    })
})
