import {LocalInterface} from '../../LocalInterface'
import {readFileSync} from 'node:fs'
import {randomBytes} from 'node:crypto'

/**
 * Files holding the machine ID, in the order libdbus and GDBus read them, followed by the locations used by
 * Homebrew's dbus on macOS (Apple silicon and Intel), so the ID matches the rest of the machine where dbus is installed.
 */
export const MACHINE_ID_FILES: string[] = [
    '/etc/machine-id',
    '/var/lib/dbus/machine-id',
    '/opt/homebrew/var/lib/dbus/machine-id',
    '/usr/local/var/lib/dbus/machine-id'
]

/**
 * Reads the machine ID from the first of the given files holding a valid one (32 lowercase hexadecimal digits).
 *
 * @param files - Candidate files, in order of preference.
 * @returns The machine ID, or undefined if none of the files holds one.
 */
export function readMachineId(files: string[] = MACHINE_ID_FILES): string | undefined {
    for (const file of files) {
        try {
            const machineId: string = readFileSync(file, 'ascii').trim()
            if (/^[0-9a-f]{32}$/.test(machineId)) return machineId
        } catch {
            // Missing or unreadable, try the next location
        }
    }
    return undefined
}

let processMachineId: string | undefined

/**
 * The machine ID reported by every Peer interface of this process.
 * Without a machine-id file (e.g. macOS or Windows without dbus installed) a random ID in the same format is
 * generated once per process: it then only identifies this process, which is enough for peers comparing IDs to
 * decide whether they share a machine, but it changes when the process restarts.
 *
 * @returns 32 lowercase hexadecimal digits.
 */
export function getMachineId(): string {
    if (!processMachineId) processMachineId = readMachineId() || randomBytes(16).toString('hex')
    return processMachineId
}

/**
 * A class representing the DBus Peer interface.
 * This interface provides basic peer-to-peer functionality for DBus connections,
 * including retrieving the machine ID and a simple ping method for testing connectivity.
 * Implements the 'org.freedesktop.DBus.Peer' interface.
 */
export class PeerInterface extends LocalInterface {
    /**
     * Constructor for the PeerInterface.
     * Initializes the interface with the name 'org.freedesktop.DBus.Peer'
     * and defines two methods: 'GetMachineId' to retrieve the machine UUID,
     * and 'Ping' for connectivity testing.
     */
    constructor() {
        super('org.freedesktop.DBus.Peer')
        this
            .defineMethod({
                name: 'GetMachineId',
                outputArgs: [{
                    name: 'machine_uuid',
                    type: 's' // String type for the machine UUID
                }],
                method: (): string => getMachineId()
            })
            .defineMethod({
                name: 'Ping',
                method: (): void => undefined
                // A no-op method used to test connectivity between peers.
                // Does not return any value or perform any action.
            })
    }
}
