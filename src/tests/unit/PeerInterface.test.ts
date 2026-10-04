import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {MACHINE_ID_FILES, PeerInterface, readMachineId} from '../../lib/common/PeerInterface'

describe('PeerInterface', (): void => {

    async function getMachineId(peer: PeerInterface = new PeerInterface()): Promise<string> {
        return (await peer.callMethod('GetMachineId', '')).result
    }

    it('returns the machine id as 32 lowercase hex digits', async (): Promise<void> => {
        assert.match(await getMachineId(), /^[0-9a-f]{32}$/)
    })

    it('returns the same machine id on every call and from every instance', async (): Promise<void> => {
        assert.equal(await getMachineId(), await getMachineId())
        assert.equal(await getMachineId(new PeerInterface()), await getMachineId(new PeerInterface()))
    })

    it('returns the machine id the local dbus installation uses, if any', async (): Promise<void> => {
        const installed: string | undefined = MACHINE_ID_FILES.filter((file: string): boolean => existsSync(file))
            .map((file: string): string => readFileSync(file, 'ascii').trim())
            .find((machineId: string): boolean => /^[0-9a-f]{32}$/.test(machineId))
        if (!installed) return
        assert.equal(await getMachineId(), installed)
    })

    it('answers Ping', async (): Promise<void> => {
        assert.deepEqual(await new PeerInterface().callMethod('Ping', ''), {signature: undefined, result: undefined})
    })

    describe('machine id files', (): void => {
        let dir: string

        before((): void => {
            dir = mkdtempSync(path.join(tmpdir(), 'dbus-sdk-machine-id-'))
            writeFileSync(path.join(dir, 'valid'), '0123456789abcdef0123456789abcdef\n')
            writeFileSync(path.join(dir, 'other'), 'fedcba9876543210fedcba9876543210\n')
            writeFileSync(path.join(dir, 'invalid'), 'E0E67C0D-5D6B-5984-835C-422CDCB5EA35\n')
        })

        after((): void => {
            rmSync(dir, {recursive: true, force: true})
        })

        it('reads the first file holding a valid id', (): void => {
            assert.equal(readMachineId([path.join(dir, 'missing'), path.join(dir, 'valid'), path.join(dir, 'other')]), '0123456789abcdef0123456789abcdef')
        })

        it('skips a file whose content is not a machine id', (): void => {
            assert.equal(readMachineId([path.join(dir, 'invalid'), path.join(dir, 'other')]), 'fedcba9876543210fedcba9876543210')
        })

        it('returns undefined when no file holds an id', (): void => {
            assert.equal(readMachineId([path.join(dir, 'missing'), path.join(dir, 'invalid')]), undefined)
        })
    })
})
