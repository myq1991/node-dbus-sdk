import {LocalService} from '../../LocalService'
import {LocalObject} from '../../LocalObject'
import {LocalInterface} from '../../LocalInterface'

/**
 * A service started by dbus-daemon through D-Bus activation (see PrivateBus activatable services).
 *
 *     node build/tests/fixtures/ActivatableService.js <bus name>
 *
 * Claims the bus name on the bus that started it and exposes /org/example/Activated with org.example.Activated.Pid,
 * returning its process id. Exits when the bus connection closes.
 */
export const ACTIVATED_OBJECT_PATH: string = '/org/example/Activated'

export const ACTIVATED_INTERFACE: string = 'org.example.Activated'

export function activatableServiceCommand(name: string): string[] {
    return [process.execPath, __filename, name]
}

async function main(): Promise<void> {
    const name: string = process.argv[2]
    const busAddress: string | undefined = process.env.DBUS_STARTER_ADDRESS || process.env.DBUS_SESSION_BUS_ADDRESS
    const object: LocalObject = new LocalObject(ACTIVATED_OBJECT_PATH)
    object.addInterface(new LocalInterface(ACTIVATED_INTERFACE).defineMethod({
        name: 'Pid',
        outputArgs: [{type: 'u'}],
        method: (): number => process.pid
    }))
    const service: LocalService = new LocalService(name)
    service.addObject(object)
    await service.run({busAddress})
    service.dbus.on('connectionClose', (): never => process.exit(0))
}

if (require.main === module) {
    main().catch((error: Error): never => {
        console.error(error)
        process.exit(1)
    })
}
