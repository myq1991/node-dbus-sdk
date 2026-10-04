import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBus} from '../../DBus'
import {LocalService} from '../../LocalService'
import {LocalObject} from '../../LocalObject'
import {LocalInterface} from '../../LocalInterface'
import {CreateDBusError} from '../../lib/CreateDBusError'
import {inspect, isDeepStrictEqual} from 'node:util'
import {PrivateBus} from '../helpers/PrivateBus'
import {gdbusCall, gdbusCliAvailable, GDBusEchoService, pygobjectAvailable} from '../helpers/GDBus'
import {involvesUnixFd, loadWireMatrix, MatrixCase, splitSignature, toExpected, toInput, WireMatrix} from '../helpers/TaggedValue'
import {knownCodecFailures, knownFailure} from '../fixtures/KnownFailures'
import {withTimeout} from '../helpers/Async'
import {knownBug} from '../helpers/KnownBug'

const matrix: WireMatrix = loadWireMatrix()

const ECHO_SERVICE: string = 'org.example.LibraryEcho'
const ECHO_PATH: string = '/org/example/Echo'
const ECHO_INTERFACE: string = 'org.example.Echo'

const GDBUS_CLIENT_CHECK: string = 'interop gdbus client'
const GDBUS_SERVICE_CHECK: string = 'interop gdbus service'

/**
 * UNIX_FD values are skipped: a bus only accepts them together with real file descriptors.
 */
const CASES: MatrixCase[] = matrix.cases.filter((testCase: MatrixCase): boolean => !involvesUnixFd(testCase))

function options(testCase: MatrixCase, check: string): { todo?: string } {
    const own: string | undefined = knownFailure(testCase.id, check)
    if (own) return knownBug(own)
    const codec: string[] = knownCodecFailures(testCase.id)
    return codec.length ? knownBug(`same defect as the codec tests: ${codec.join('; ')}`) : {}
}

/**
 * The case gdbus is currently calling with; the service checks the arguments against it and replies with its values.
 */
let currentCase: MatrixCase | undefined

/**
 * A LocalService with one method per matrix signature. Instead of echoing what it decoded, each method checks the
 * decoded arguments against the case's expected values (testing the decoder) and replies with the case's values as a
 * library user would pass them (testing the encoder), so a failure points at one side.
 */
function createReferenceService(serviceName: string): LocalService {
    const iface: LocalInterface = new LocalInterface(ECHO_INTERFACE)
    for (const [signature, name] of Object.entries(matrix.echoMethods)) {
        const args: { type: string }[] = splitSignature(signature).map((type: string): { type: string } => ({type}))
        iface.defineMethod({
            name,
            inputArgs: args,
            outputArgs: args,
            method: (...received: any[]): any => {
                const testCase: MatrixCase = currentCase!
                if (!isDeepStrictEqual(received, toExpected(testCase.args))) {
                    throw CreateDBusError('org.example.Error.DecodedMismatch', `decoded ${inspect(received, {depth: null})}`)
                }
                const reply: any[] = toInput(testCase.args)
                return reply.length === 1 ? reply[0] : reply
            }
        })
    }
    const object: LocalObject = new LocalObject(ECHO_PATH)
    object.addInterface(iface)
    const service: LocalService = new LocalService(serviceName)
    service.addObject(object)
    return service
}

/**
 * Every GDBus reference case, sent through a real dbus-daemon between this library and GDBus in both directions.
 * The daemon validates each message, so any malformed output is caught even when both sides would agree on it.
 */
describe('wire format matrix through dbus-daemon', {skip: !PrivateBus.available && 'dbus-daemon not found', timeout: 600000}, (): void => {
    let bus: PrivateBus

    before(async (): Promise<void> => {
        bus = await PrivateBus.start()
    })

    after(async (): Promise<void> => {
        await bus.stop()
    })

    // Every case gets its own service connection (and bus name) and its own client connection: a malformed message
    // makes the daemon drop the sender, and the library throws from its socket handler on data it cannot decode, so
    // any such failure stays attributed to the case that caused it.

    describe('gdbus client calling LocalService', {skip: !gdbusCliAvailable && 'gdbus not found'}, (): void => {
        CASES.forEach((testCase: MatrixCase, index: number): void => {
            it(testCase.id, options(testCase, GDBUS_CLIENT_CHECK), async (): Promise<void> => {
                const serviceName: string = `${ECHO_SERVICE}.c${index}`
                const service: LocalService = createReferenceService(serviceName)
                await withTimeout(service.run({busAddress: bus.address}), 5000, 'start reference service')
                try {
                    currentCase = testCase
                    const reply: string = await gdbusCall(bus.address, serviceName, ECHO_PATH, `${ECHO_INTERFACE}.${matrix.echoMethods[testCase.signature]}`, testCase.texts)
                    assert.equal(reply, testCase.replyText)
                } finally {
                    await withTimeout(service.stop(), 1000, 'stop reference service').catch((): void => undefined)
                }
            })
        })
    })

    describe('library client calling a GDBus service', {skip: !pygobjectAvailable && 'python3 with PyGObject not found'}, (): void => {
        let echo: GDBusEchoService

        before(async (): Promise<void> => {
            echo = await GDBusEchoService.start(bus.address)
        })

        after(async (): Promise<void> => {
            await echo.stop()
        })

        for (const testCase of CASES) {
            it(testCase.id, options(testCase, GDBUS_SERVICE_CHECK), async (): Promise<void> => {
                const client: DBus = await withTimeout(DBus.connect({busAddress: bus.address}), 5000, 'connect client')
                // Pending calls never settle when the connection closes, so fail fast instead of waiting for the timeout
                const closed: Promise<never> = new Promise<never>((_resolve, reject): void => {
                    client.on('connectionClose', (): void => reject(new Error('dbus-daemon closed the connection, so the call was malformed')))
                })
                closed.catch((): void => undefined)
                try {
                    const reply: any[] = await withTimeout(Promise.race([closed, client.invoke({
                        service: GDBusEchoService.SERVICE_NAME,
                        objectPath: GDBusEchoService.OBJECT_PATH,
                        interface: GDBusEchoService.INTERFACE,
                        method: matrix.echoMethods[testCase.signature],
                        signature: testCase.signature,
                        args: toInput(testCase.args)
                    })]), 3000, 'echo call')
                    assert.deepEqual(reply, toExpected(testCase.args))
                } finally {
                    await withTimeout(client.disconnect(), 1000, 'disconnect client').catch((): void => undefined)
                }
            })
        }
    })
})
