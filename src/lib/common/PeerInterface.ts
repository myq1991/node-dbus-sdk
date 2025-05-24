import {LocalInterface} from '../../LocalInterface'
import {getMachineId} from 'native-machine-id'
import {randomUUID} from 'node:crypto'

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
                method: async (): Promise<string> => (await getMachineId({raw: true})) || randomUUID()
                // Retrieves the machine ID using native-machine-id library.
                // If retrieval fails or returns an empty value, generates a random UUID as fallback.
            })
            .defineMethod({
                name: 'Ping',
                method: (): void => undefined
                // A no-op method used to test connectivity between peers.
                // Does not return any value or perform any action.
            })
    }
}
