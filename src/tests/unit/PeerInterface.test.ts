import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {PeerInterface} from '../../lib/common/PeerInterface'
import {knownBug} from '../helpers/KnownBug'

describe('PeerInterface', (): void => {

    async function getMachineId(): Promise<string> {
        return (await new PeerInterface().callMethod('GetMachineId', '')).result
    }

    // On Linux native-machine-id happens to return /etc/machine-id, which is already in the right format
    it('returns the machine id as 32 lowercase hex digits', process.platform === 'linux' ? {} : knownBug('native-machine-id returns a platform UUID with dashes and upper case letters on non-Linux systems'), async (): Promise<void> => {
        assert.match(await getMachineId(), /^[0-9a-f]{32}$/)
    })

    it('returns the same machine id on every call', async (): Promise<void> => {
        assert.equal(await getMachineId(), await getMachineId())
    })

    it('answers Ping', async (): Promise<void> => {
        assert.deepEqual(await new PeerInterface().callMethod('Ping', ''), {signature: undefined, result: undefined})
    })
})
