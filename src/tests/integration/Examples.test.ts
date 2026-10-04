import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {ChildProcess, execFile, spawn} from 'node:child_process'
import module from 'node:module'
import path from 'node:path'
import {PrivateBus, releaseWhenDone} from '../helpers/PrivateBus'

const ROOT: string = path.resolve(__dirname, '../../..')
const EXAMPLES: string = path.join(ROOT, 'examples')

// The examples are TypeScript run directly by Node (type stripping) with a hook that resolves 'dbus-sdk' to this build
const nodeRunsExamples: boolean = !!(process.features as { typescript?: unknown }).typescript && typeof (module as any).registerHooks === 'function'

interface ExampleRun {
    code: number | null
    stdout: string
    stderr: string
}

/**
 * Starts an example on the given bus, as `node --import ./examples/use-local-build.mjs examples/<name>`.
 */
function startExample(name: string, busAddress: string, args: string[] = []): ChildProcess {
    return spawn(process.execPath, ['--import', path.join(EXAMPLES, 'use-local-build.mjs'), path.join(EXAMPLES, name), ...args], {
        cwd: ROOT,
        env: {...process.env, DBUS_SESSION_BUS_ADDRESS: busAddress, NODE_NO_WARNINGS: '1'}
    })
}

/**
 * Collects an example's output until it exits, killing it after the timeout.
 */
function finished(child: ChildProcess, timeout: number = 20000): Promise<ExampleRun> {
    return new Promise((resolve): void => {
        let stdout: string = ''
        let stderr: string = ''
        child.stdout!.on('data', (chunk: Buffer): void => {
            stdout += chunk.toString()
        })
        child.stderr!.on('data', (chunk: Buffer): void => {
            stderr += chunk.toString()
        })
        const timer: NodeJS.Timeout = setTimeout((): boolean => child.kill('SIGKILL'), timeout)
        child.on('exit', (code: number | null): void => {
            clearTimeout(timer)
            // Let the pipes drain
            setImmediate((): void => resolve({code, stdout, stderr}))
        })
    })
}

/**
 * Resolves once the child has written the given text to stdout.
 */
function printed(child: ChildProcess, text: string, timeout: number = 10000): Promise<void> {
    return new Promise((resolve, reject): void => {
        let output: string = ''
        const timer: NodeJS.Timeout = setTimeout((): void => reject(new Error(`"${text}" not printed within ${timeout} ms: ${output}`)), timeout)
        child.stdout!.on('data', (chunk: Buffer): void => {
            output += chunk.toString()
            if (output.includes(text)) {
                clearTimeout(timer)
                resolve()
            }
        })
    })
}

function assertSucceeded(run: ExampleRun): void {
    assert.equal(run.code, 0, `exit code ${run.code}\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`)
}

/**
 * Every example in examples/ runs against a private bus and prints what it promises, so the examples cannot silently
 * fall behind the library.
 */
describe('examples', {skip: (!PrivateBus.available && 'dbus-daemon not found') || (!nodeRunsExamples && 'this Node.js cannot run TypeScript files'), timeout: 120000}, (): void => {
    let bus: PrivateBus

    before(async (): Promise<void> => {
        bus = await PrivateBus.start()
    })

    after(async (): Promise<void> => {
        if (bus) await bus.stop()
    })

    it('type-check against the published declarations', async (): Promise<void> => {
        const tsc: string = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')
        await new Promise<void>((resolve, reject): void => {
            execFile(process.execPath, [tsc, '-p', EXAMPLES], {cwd: ROOT}, (error, stdout: string): void => error ? reject(new Error(`tsc -p examples failed:\n${stdout}`)) : resolve())
        })
    })

    it('01-bus-basics asks the bus about itself', async (): Promise<void> => {
        const run: ExampleRun = await finished(startExample('01-bus-basics.ts', bus.address))
        assertSucceeded(run)
        assert.match(run.stdout, /connected as :1\.\d+/)
        assert.match(run.stdout, /bus id: [0-9a-f]{32}/)
        assert.match(run.stdout, /org\.example\.Nobody has an owner: false/)
    })

    it('02-greeter-service serves 03-greeter-client and stops gracefully', async (): Promise<void> => {
        const service: ChildProcess = startExample('02-greeter-service.ts', bus.address)
        releaseWhenDone(service)
        const serviceRun: Promise<ExampleRun> = finished(service)
        await printed(service, 'org.example.Greeter is ready')

        const client: ExampleRun = await finished(startExample('03-greeter-client.ts', bus.address))
        assertSucceeded(client)
        for (const expected of [
            'Hello, Alice!',
            'Hello, Bob!',
            'greeted 2 times since',
            'Slow(10) returned undefined',
            'Divide failed: org.example.Greeter1.Error.DivisionByZero: Cannot divide by zero',
            'Slow(1000): timed out',
            'Greeting is Hello',
            'Howdy, Carol!',
            'rejected: The greeting cannot be empty',
            'signal Greeted: Alice (#1)',
            'signal PropertiesChanged: org.example.Greeter1 { Greeting: \'Howdy\' } []'
        ]) assert.ok(client.stdout.includes(expected), `missing "${expected}" in:\n${client.stdout}`)
        assert.match(client.stdout, /the service sees me as (:1\.\d+) - my unique name is \1/)

        service.kill('SIGTERM')
        const run: ExampleRun = await serviceRun
        assertSucceeded(run)
        assert.match(run.stdout, /stopped/)
    })

    it('04-signals emits and receives signals and bus events', async (): Promise<void> => {
        const run: ExampleRun = await finished(startExample('04-signals.ts', bus.address))
        assertSucceeded(run)
        for (const count of [1, 2, 3]) assert.match(run.stdout, new RegExp(`Tick #${count} at `))
        assert.match(run.stdout, /\(any signal\) Tick/)
        assert.match(run.stdout, /online: org\.example\.Clock/)
        assert.match(run.stdout, /offline: org\.example\.Clock/)
    })

    it('05-types shows the type mapping', async (): Promise<void> => {
        const run: ExampleRun = await finished(startExample('05-types.ts', bus.address))
        assertSucceeded(run)
        for (const expected of [
            '[ -4611686018427387904n, 9223372036854775808n ]',
            '<Buffer 68 69>',
            '[ \'answer\', 42 ]',
            '[ \'s\', \'i\', \'x\', \'d\' ]',
            '[ \'ai\', \'(is)\', \'a{sv}\', \'aa{sv}\' ]',
            '{ name: \'disk\', size: 1099511627776n, ratio: 0.5, tags: [ \'a\', \'b\' ] }',
            '{ count: 7, path: \'/a\' }',
            'InvalidValueError: BYTE must be an integer from 0 to 255, got 256',
            'ObjectPathError: Invalid DBus object path'
        ]) assert.ok(run.stdout.includes(expected), `missing "${expected}" in:\n${run.stdout}`)
    })

    it('06-object-manager lists objects and follows changes', async (): Promise<void> => {
        const run: ExampleRun = await finished(startExample('06-object-manager.ts', bus.address))
        assertSucceeded(run)
        assert.match(run.stdout, /managed \/org\/example\/devices\/sda \{ Id: 'sda', Model: 'Disk A' \}/)
        assert.match(run.stdout, /added \/org\/example\/devices\/sdb \{ Id: 'sdb', Model: 'Disk B' \}/)
        assert.match(run.stdout, /removed \/org\/example\/devices\/sdb \[ 'org\.example\.Device1' \]/)
    })

    it('07-introspect walks a service', async (): Promise<void> => {
        const run: ExampleRun = await finished(startExample('07-introspect.ts', bus.address, ['org.freedesktop.DBus']))
        assertSucceeded(run)
        assert.match(run.stdout, /org\.freedesktop\.DBus \(org\.freedesktop\.DBus\): \d+ object\(s\)/)
        assert.match(run.stdout, /method {3}GetId\(\) → s/)
        assert.match(run.stdout, /signal {3}NameOwnerChanged\(s, s, s\)/)
    })
})
