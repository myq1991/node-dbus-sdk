import {ChildProcess, spawn, spawnSync} from 'node:child_process'
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'

const DBUS_DAEMON: string = process.env.DBUS_DAEMON || 'dbus-daemon'

/**
 * Unix socket paths are limited to ~104 bytes on macOS, so fall back to /tmp when the system temp dir is long.
 */
function createTempDir(): string {
    const base: string = tmpdir().length > 60 ? '/tmp' : tmpdir()
    return mkdtempSync(path.join(base, 'dbus-sdk-test-'))
}

/**
 * Keeps a helper process from holding the test process open, e.g. when a failing before() hook never reaches the
 * matching after() cleanup, and terminates it when the test process exits.
 */
export function releaseWhenDone(child: ChildProcess): void {
    // Keep draining the pipes rather than closing them: dbus-daemon passes them on to the services it activates
    for (const pipe of [child.stdout, child.stderr]) {
        pipe?.resume()
        ;(pipe as any)?.unref?.()
    }
    child.unref()
    process.once('exit', (): void => {
        if (child.exitCode === null) child.kill('SIGKILL')
    })
}

export interface PrivateBusOptions {
    /**
     * Also listen on TCP (127.0.0.1, random port). TCP connections cannot use EXTERNAL, so enable DBUS_COOKIE_SHA1.
     */
    tcp?: boolean
    /**
     * Authentication mechanisms the daemon accepts, in order. Defaults to EXTERNAL only.
     */
    auth?: string[]
    /**
     * Services the daemon can start on demand (D-Bus activation), written to its service directory before it starts.
     */
    activatable?: ActivatableService[]
}

export interface ActivatableService {
    name: string
    /**
     * Command line the daemon runs to start the service; it must claim `name` on the bus at DBUS_STARTER_ADDRESS.
     */
    command: string[]
}

function writeServiceFile(directory: string, service: ActivatableService): void {
    writeFileSync(path.join(directory, `${service.name}.service`), `[D-BUS Service]\nName=${service.name}\nExec=${service.command.join(' ')}\n`)
}

/**
 * A dbus-daemon instance private to a test file, listening on a temporary unix socket (and optionally TCP).
 * The daemon runs with its own HOME, where it keeps the DBUS_COOKIE_SHA1 keyring; clients authenticating with
 * cookies must use the same HOME (see `withHome`).
 * Requires `dbus-daemon` on PATH (or the DBUS_DAEMON environment variable).
 */
export class PrivateBus {

    /**
     * Whether a dbus-daemon executable is available. Integration tests are skipped when it is not.
     */
    public static readonly available: boolean = !spawnSync(DBUS_DAEMON, ['--version']).error

    readonly #process: ChildProcess

    readonly #dir: string

    /**
     * All addresses the daemon listens on, as printed by it (separated by ';').
     */
    public readonly address: string

    public readonly unixAddress: string

    public readonly tcpAddress: string | undefined

    public readonly socketPath: string

    /**
     * HOME of the daemon, holding its .dbus-keyrings directory.
     */
    public readonly home: string

    /**
     * Directory the daemon loads activatable service files from.
     */
    public readonly serviceDir: string

    protected constructor(process: ChildProcess, dir: string, address: string) {
        this.#process = process
        this.#dir = dir
        this.address = address
        const addresses: string[] = address.split(';')
        this.unixAddress = addresses.find((item: string): boolean => item.startsWith('unix:'))!
        this.tcpAddress = addresses.find((item: string): boolean => item.startsWith('tcp:'))
        this.socketPath = path.join(dir, 'bus.sock')
        this.home = path.join(dir, 'home')
        this.serviceDir = path.join(dir, 'services')
    }

    /**
     * Starts a dbus-daemon with a permissive session-bus policy.
     *
     * @param options - Listen addresses and authentication mechanisms.
     * @returns The running bus, once it is accepting connections.
     */
    public static async start(options: PrivateBusOptions = {}): Promise<PrivateBus> {
        const dir: string = createTempDir()
        const home: string = path.join(dir, 'home')
        mkdirSync(home, {mode: 0o700})
        const serviceDir: string = path.join(dir, 'services')
        mkdirSync(serviceDir)
        for (const service of options.activatable || []) writeServiceFile(serviceDir, service)
        const configFile: string = path.join(dir, 'bus.conf')
        const auth: string[] = options.auth || ['EXTERNAL']
        writeFileSync(configFile, `<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-Bus Bus Configuration 1.0//EN" "http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">
<busconfig>
  <type>session</type>
  <listen>unix:path=${path.join(dir, 'bus.sock')}</listen>
  ${options.tcp ? '<listen>tcp:host=127.0.0.1,bind=127.0.0.1,port=0,family=ipv4</listen>' : ''}
  ${auth.map((mechanism: string): string => `<auth>${mechanism}</auth>`).join('\n  ')}
  ${auth.includes('ANONYMOUS') ? '<allow_anonymous/>' : ''}
  <servicedir>${serviceDir}</servicedir>
  <policy context="default">
    <allow send_destination="*" eavesdrop="true"/>
    <allow eavesdrop="true"/>
    <allow own="*"/>
  </policy>
</busconfig>
`)
        const daemon: ChildProcess = spawn(DBUS_DAEMON, ['--nofork', '--print-address', `--config-file=${configFile}`], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {...process.env, HOME: home}
        })
        const address: string = await new Promise<string>((resolve, reject): void => {
            let stdout: string = ''
            let stderr: string = ''
            daemon.stdout!.on('data', (chunk: Buffer): void => {
                stdout += chunk.toString()
                const newline: number = stdout.indexOf('\n')
                if (newline >= 0) resolve(stdout.substring(0, newline).trim())
            })
            daemon.stderr!.on('data', (chunk: Buffer): string => stderr += chunk.toString())
            daemon.once('error', reject)
            daemon.once('exit', (code: number | null): void => reject(new Error(`dbus-daemon exited with code ${code}: ${stderr}`)))
        })
        releaseWhenDone(daemon)
        return new PrivateBus(daemon, dir, address)
    }

    /**
     * Adds an activatable service file. The daemon only picks it up after ReloadConfig.
     */
    public addActivatableService(service: ActivatableService): void {
        writeServiceFile(this.serviceDir, service)
    }

    /**
     * Runs an operation with process.env.HOME pointing at the daemon's HOME, so DBUS_COOKIE_SHA1 finds its keyring.
     */
    public async withHome<T>(operation: () => Promise<T>): Promise<T> {
        const original: string | undefined = process.env.HOME
        process.env.HOME = this.home
        try {
            return await operation()
        } finally {
            process.env.HOME = original
        }
    }

    /**
     * Terminates the daemon and removes its temporary directory.
     */
    public async stop(): Promise<void> {
        if (this.#process.exitCode === null) {
            await new Promise<void>((resolve): void => {
                // Referenced again so the test process stays alive until the exit is observed
                this.#process.ref()
                this.#process.once('exit', (): void => resolve())
                this.#process.kill('SIGTERM')
            })
        }
        rmSync(this.#dir, {recursive: true, force: true})
    }
}
