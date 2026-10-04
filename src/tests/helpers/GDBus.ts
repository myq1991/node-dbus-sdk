import {ChildProcess, execFile, spawn, spawnSync} from 'node:child_process'
import path from 'node:path'
import {releaseWhenDone} from './PrivateBus'

const FIXTURES: string = path.resolve(__dirname, '../../../src/tests/fixtures/gdbus')

/**
 * Whether the `gdbus` command line tool is available.
 */
export const gdbusCliAvailable: boolean = !spawnSync('gdbus', ['help']).error

/**
 * Whether python3 with PyGObject (GLib's GDBus bindings) is available.
 */
export const pygobjectAvailable: boolean = spawnSync('python3', ['-c', 'import gi; gi.require_version("Gio", "2.0")']).status === 0

/**
 * The environment for gdbus: it prints text in the locale's character set, so under a non-UTF-8 locale (e.g. the
 * POSIX default of containers) non-ASCII characters in replies come out as '?'.
 */
function utf8Environment(): NodeJS.ProcessEnv {
    const locale: string = process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG || ''
    return /utf-?8/i.test(locale) ? process.env : {...process.env, LC_ALL: 'C.UTF-8'}
}

/**
 * Calls a method with `gdbus call`, passing arguments in GVariant text form.
 *
 * @returns The reply as printed by gdbus (GVariant text of the reply tuple).
 */
export function gdbusCall(address: string, service: string, objectPath: string, method: string, args: string[]): Promise<string> {
    return new Promise<string>((resolve, reject): void => {
        execFile('gdbus', ['call', '--address', address, '--dest', service, '--object-path', objectPath, '--method', method, '--timeout', '3', '--', ...args], {timeout: 5000, env: utf8Environment()}, (error, stdout: string, stderr: string): void => {
            if (error) return reject(new Error(`${stderr.trim() || error.message}`))
            resolve(stdout.trim())
        })
    })
}

/**
 * The GDBus echo service from src/tests/fixtures/gdbus/echo_service.py, running against a bus.
 */
export class GDBusEchoService {

    public static readonly SERVICE_NAME: string = 'org.example.GDBusEcho'

    public static readonly OBJECT_PATH: string = '/org/example/Echo'

    public static readonly INTERFACE: string = 'org.example.Echo'

    readonly #process: ChildProcess

    protected constructor(process: ChildProcess) {
        this.#process = process
    }

    /**
     * Starts the service and waits until it owns its bus name.
     *
     * @param address - Bus address.
     */
    public static async start(address: string): Promise<GDBusEchoService> {
        const child: ChildProcess = spawn('python3', [path.join(FIXTURES, 'echo_service.py'), address, path.join(FIXTURES, 'wire-matrix.json')], {stdio: ['ignore', 'pipe', 'pipe']})
        await new Promise<void>((resolve, reject): void => {
            let stderr: string = ''
            child.stdout!.on('data', (chunk: Buffer): void => {
                if (chunk.toString().includes('READY')) resolve()
            })
            child.stderr!.on('data', (chunk: Buffer): string => stderr += chunk.toString())
            child.once('error', reject)
            child.once('exit', (code: number | null): void => reject(new Error(`echo service exited with code ${code}: ${stderr}`)))
        })
        releaseWhenDone(child)
        return new GDBusEchoService(child)
    }

    public async stop(): Promise<void> {
        if (this.#process.exitCode !== null) return
        await new Promise<void>((resolve): void => {
            // Referenced again so the test process stays alive until the exit is observed
            this.#process.ref()
            this.#process.once('exit', (): void => resolve())
            this.#process.kill('SIGTERM')
        })
    }
}
