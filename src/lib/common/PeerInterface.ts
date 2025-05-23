import {LocalInterface} from '../../LocalInterface'
import {getMachineId} from 'native-machine-id'
import {randomUUID} from 'node:crypto'

export class PeerInterface extends LocalInterface {
    constructor() {
        super('org.freedesktop.DBus.Peer')
        this
            .defineMethod({
                name: 'GetMachineId',
                outputArgs: [{
                    name: 'machine_uuid',
                    type: 's'
                }],
                method: async (): Promise<string> => (await getMachineId({raw: true})) || randomUUID()
            })
            .defineMethod({
                name: 'Ping',
                method: (): void => undefined
            })
    }
}