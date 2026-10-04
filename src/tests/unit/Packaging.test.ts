import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {knownBug} from '../helpers/KnownBug'

const ROOT: string = path.resolve(__dirname, '../../..')

function readPackageJson(dir: string): Record<string, any> {
    return JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'))
}

describe('packaging', (): void => {

    it('has no runtime dependency that compiles native code on install', knownBug('native-machine-id runs node-gyp on install, which fails with newer Python versions and on devices without a toolchain'), (): void => {
        const dependencies: string[] = Object.keys(readPackageJson(ROOT).dependencies || {})
        const native: string[] = dependencies.filter((dependency: string): boolean => {
            const manifest: Record<string, any> = readPackageJson(path.join(ROOT, 'node_modules', dependency))
            const installScripts: string = [manifest.scripts?.preinstall, manifest.scripts?.install, manifest.scripts?.postinstall].filter(Boolean).join(' ')
            return !!manifest.gypfile || /node-gyp|prebuild|cmake-js/.test(installScripts)
        })
        assert.deepEqual(native, [])
    })
})
