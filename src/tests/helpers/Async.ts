import {execFile} from 'node:child_process'

/**
 * Rejects if the promise does not settle within the given time.
 * Calls without a reply never settle in this library, so integration tests guard every bus round trip with this.
 *
 * @param promise - The operation to wait for.
 * @param ms - Timeout in milliseconds.
 * @param label - Description used in the timeout error.
 * @returns The settled value of the promise.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined
    const timeout: Promise<never> = new Promise<never>((_resolve, reject): void => {
        timer = setTimeout((): void => reject(new Error(`Timed out after ${ms}ms: ${label}`)), ms)
    })
    try {
        return await Promise.race([promise, timeout])
    } finally {
        clearTimeout(timer)
    }
}

/**
 * Resolves with the first emission of an event, or rejects on timeout.
 *
 * @param emitter - Object with an `once` method.
 * @param eventName - Event to wait for.
 * @param ms - Timeout in milliseconds.
 * @returns The event arguments.
 */
export function nextEvent(emitter: { once(eventName: string, listener: (...args: any[]) => void): any }, eventName: string, ms: number = 3000): Promise<any[]> {
    return withTimeout(new Promise<any[]>((resolve): void => {
        emitter.once(eventName, (...args: any[]): void => resolve(args))
    }), ms, `event ${eventName}`)
}

/**
 * Runs an operation and collects any promise rejections nobody handled while it ran.
 * In production an unhandled rejection terminates the Node.js process, so a non-empty result means a crash.
 *
 * @param operation - The operation to observe; its own outcome is returned unchanged.
 * @returns The operation's settled outcome and the unhandled rejection reasons.
 */
export async function catchUnhandledRejections<T>(operation: () => Promise<T>): Promise<{ result: PromiseSettledResult<T>, unhandled: unknown[] }> {
    const unhandled: unknown[] = []
    const listener: (reason: unknown) => void = (reason: unknown): number => unhandled.push(reason)
    process.on('unhandledRejection', listener)
    try {
        const [result] = await Promise.allSettled([operation()])
        // Unhandled rejections are reported after the microtask queue drains
        await new Promise<void>((resolve): NodeJS.Immediate => setImmediate(resolve))
        await new Promise<void>((resolve): NodeJS.Immediate => setImmediate(resolve))
        return {result, unhandled}
    } finally {
        process.off('unhandledRejection', listener)
    }
}

/**
 * Runs dbus-send (libdbus) against the given bus and returns its stdout.
 *
 * @param address - Bus address.
 * @param args - Arguments after `--bus=<address>`.
 * @returns The printed reply.
 */
export function dbusSend(address: string, args: string[]): Promise<string> {
    return new Promise<string>((resolve, reject): void => {
        execFile('dbus-send', [`--bus=${address}`, '--reply-timeout=3000', ...args], {timeout: 5000}, (error, stdout: string, stderr: string): void => {
            if (error) return reject(new Error(`${error.message}\n${stderr}`))
            resolve(stdout)
        })
    })
}
