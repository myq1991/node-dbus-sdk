import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBus} from '../../DBus'
import {DBusService} from '../../DBusService'
import {DBusInterface} from '../../DBusInterface'
import {BusNameBasicInfo} from '../../types/BusNameBasicInfo'
import {PrivateBus} from '../helpers/PrivateBus'
import {createTestService, TestService} from '../helpers/TestService'
import {activatableServiceCommand, ACTIVATED_INTERFACE, ACTIVATED_OBJECT_PATH} from '../fixtures/ActivatableService'
import {withTimeout} from '../helpers/Async'
import {knownBug} from '../helpers/KnownBug'

const RUNNING_SERVICE: string = 'org.example.Running'
const ACTIVATABLE: string = 'org.example.Activatable'
const ACTIVATED_BY_GET_SERVICE: string = 'org.example.ActivatedByGetService'
const LISTED_ONLY: string = 'org.example.ListedOnly'

/**
 * dbus-daemon only knows the process ids of its clients on platforms with peer credentials (Linux);
 * elsewhere (e.g. macOS) it answers GetConnectionUnixProcessID with UnixProcessIdUnknown for every client.
 */
const PEER_PIDS_KNOWN: boolean = process.platform === 'linux'
const NO_PEER_PIDS: string | false = !PEER_PIDS_KNOWN && 'dbus-daemon cannot determine client process ids on this platform'

/**
 * Queries against org.freedesktop.DBus and D-Bus activation, on a private dbus-daemon with activatable services
 * implemented by src/tests/fixtures/ActivatableService.ts.
 */
describe('bus queries and service activation', {skip: !PrivateBus.available && 'dbus-daemon not found', timeout: 60000}, (): void => {
    let bus: PrivateBus
    let server: TestService
    let client: DBus

    before(async (): Promise<void> => {
        bus = await PrivateBus.start({
            activatable: [ACTIVATABLE, ACTIVATED_BY_GET_SERVICE, LISTED_ONLY].map((name: string) => ({name, command: activatableServiceCommand(name)}))
        })
        server = createTestService(RUNNING_SERVICE)
        await withTimeout(server.service.run({busAddress: bus.address}), 3000, 'start service')
        client = await withTimeout(DBus.connect({busAddress: bus.address}), 3000, 'connect')
    })

    after(async (): Promise<void> => {
        await withTimeout(server.service.stop(), 2000, 'stop service').catch((): void => undefined)
        await withTimeout(client.disconnect(), 2000, 'disconnect').catch((): void => undefined)
        await bus.stop()
    })

    describe('names', (): void => {
        it('lists the bus, running services and unique connection names', async (): Promise<void> => {
            const names: string[] = await withTimeout(client.listNames(), 2000, 'ListNames')
            for (const expected of ['org.freedesktop.DBus', RUNNING_SERVICE, client.uniqueName]) {
                assert.ok(names.includes(expected), `missing ${expected}`)
            }
        })

        it('tells whether a name has an owner', async (): Promise<void> => {
            assert.equal(await withTimeout(client.nameHasOwner(RUNNING_SERVICE), 2000, 'NameHasOwner'), true)
            assert.equal(await withTimeout(client.nameHasOwner('org.example.Nobody'), 2000, 'NameHasOwner'), false)
        })

        it('resolves the unique name owning a well-known name', async (): Promise<void> => {
            assert.equal(await withTimeout(client.getNameOwner(RUNNING_SERVICE), 2000, 'GetNameOwner'), server.service.dbus.uniqueName)
        })

        it('returns undefined as owner of a name nobody owns', async (): Promise<void> => {
            assert.equal(await withTimeout(client.getNameOwner('org.example.Nobody'), 2000, 'GetNameOwner'), undefined)
        })

        it('returns the process id of a connection', {skip: NO_PEER_PIDS}, async (): Promise<void> => {
            assert.equal(await withTimeout(client.getConnectionUnixProcessID(client.uniqueName), 2000, 'GetConnectionUnixProcessID'), process.pid)
            assert.equal(await withTimeout(client.getConnectionUnixProcessID(RUNNING_SERVICE), 2000, 'GetConnectionUnixProcessID'), process.pid)
        })

        it('returns undefined as process id of a name nobody owns', async (): Promise<void> => {
            assert.equal(await withTimeout(client.getConnectionUnixProcessID('org.example.Nobody'), 2000, 'GetConnectionUnixProcessID'), undefined)
        })
    })

    describe('services', (): void => {
        it('describes running and activatable names', async (): Promise<void> => {
            const infos: BusNameBasicInfo[] = await withTimeout(client.listBusNames(), 3000, 'listBusNames')
            const running: BusNameBasicInfo | undefined = infos.find((info: BusNameBasicInfo): boolean => info.name === RUNNING_SERVICE)
            assert.deepEqual(running, {name: RUNNING_SERVICE, uniqueName: server.service.dbus.uniqueName, active: true, activatable: false, pid: PEER_PIDS_KNOWN ? process.pid : undefined})
            const activatable: BusNameBasicInfo | undefined = infos.find((info: BusNameBasicInfo): boolean => info.name === LISTED_ONLY)
            assert.deepEqual(activatable, {name: LISTED_ONLY, uniqueName: undefined, active: false, activatable: true, pid: undefined})
        })

        it('lists services without unique connection names', async (): Promise<void> => {
            const names: string[] = (await withTimeout(client.listServices(), 3000, 'listServices')).map((info: BusNameBasicInfo): string => info.name)
            assert.ok(names.includes(RUNNING_SERVICE))
            assert.ok(names.includes(LISTED_ONLY))
            assert.ok(!names.some((name: string): boolean => name.startsWith(':')), `unique names listed: ${names.join(', ')}`)
        })

        it('rejects getService for a name that is neither running nor activatable', async (): Promise<void> => {
            await assert.rejects(withTimeout(client.getService('org.example.Nobody'), 2000, 'getService'), {code: 'E_SERVICE_NOT_FOUND'})
        })

        it('returns the running service with its unique name', async (): Promise<void> => {
            const service: DBusService = await withTimeout(client.getService(RUNNING_SERVICE), 2000, 'getService')
            assert.equal(service.name, RUNNING_SERVICE)
            assert.equal(service.uniqueName, server.service.dbus.uniqueName)
        })
    })

    describe('activation', (): void => {
        it('lists activatable names', async (): Promise<void> => {
            const names: string[] = await withTimeout(client.listActivatableNames(), 2000, 'ListActivatableNames')
            for (const name of [ACTIVATABLE, ACTIVATED_BY_GET_SERVICE, LISTED_ONLY]) assert.ok(names.includes(name), `missing ${name}`)
        })

        it('starts a service with StartServiceByName', async (): Promise<void> => {
            assert.equal(await withTimeout(client.startServiceByName(ACTIVATABLE), 10000, 'StartServiceByName'), 1, 'DBUS_START_REPLY_SUCCESS')
            assert.equal(await withTimeout(client.nameHasOwner(ACTIVATABLE), 2000, 'NameHasOwner'), true)
            assert.equal(await withTimeout(client.startServiceByName(ACTIVATABLE), 2000, 'StartServiceByName'), 2, 'DBUS_START_REPLY_ALREADY_RUNNING')
        })

        it('starts an activatable service on getService and calls it', async (): Promise<void> => {
            const service: DBusService = await withTimeout(client.getService(ACTIVATED_BY_GET_SERVICE), 10000, 'getService')
            const iface: DBusInterface = await withTimeout((await service.getObject(ACTIVATED_OBJECT_PATH)).getInterface(ACTIVATED_INTERFACE), 2000, 'getInterface')
            const pid: number = await withTimeout(iface.method.Pid(), 2000, 'Pid')
            assert.notEqual(pid, process.pid)
            if (PEER_PIDS_KNOWN) assert.equal(await withTimeout(client.getConnectionUnixProcessID(ACTIVATED_BY_GET_SERVICE), 2000, 'GetConnectionUnixProcessID'), pid)
        })

        it('rejects StartServiceByName for an unknown name', async (): Promise<void> => {
            await assert.rejects(withTimeout(client.startServiceByName('org.example.Nobody'), 2000, 'StartServiceByName'), {name: 'org.freedesktop.DBus.Error.ServiceUnknown'})
        })

        it('picks up a new service file after ReloadConfig', async (): Promise<void> => {
            const name: string = 'org.example.AddedLater'
            bus.addActivatableService({name, command: activatableServiceCommand(name)})
            await withTimeout(client.reloadConfig(), 3000, 'ReloadConfig')
            assert.ok((await withTimeout(client.listActivatableNames(), 2000, 'ListActivatableNames')).includes(name))
        })

        // Runs last: it would start every activatable service
        it('does not start activatable services when enumerating them with getServices', knownBug('getServices() calls getService() for every listed name, which starts every activatable service'), async (): Promise<void> => {
            await withTimeout(client.getServices(), 10000, 'getServices')
            assert.equal(await withTimeout(client.nameHasOwner(LISTED_ONLY), 2000, 'NameHasOwner'), false)
        })
    })
})
