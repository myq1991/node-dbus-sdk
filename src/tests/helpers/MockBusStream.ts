import {Duplex} from 'node:stream'
import {DBusMessage} from '../../lib/DBusMessage'
import {decodeWireMessage} from './WireMessage'

/**
 * In-memory duplex stream standing in for a bus socket.
 * Everything the library writes is recorded and decoded; `deliver` feeds raw bytes back to the library
 * as if they had arrived from the bus. No handshake is performed, so it is meant to be passed straight
 * to the DBusConnection constructor.
 */
export class MockBusStream extends Duplex {

    public readonly written: Buffer[] = []

    #waiters: ((message: DBusMessage) => void)[] = []

    #pending: DBusMessage[] = []

    public _read(): void {
        // Data is pushed explicitly through deliver()
    }

    public _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        this.written.push(chunk)
        const message: DBusMessage = decodeWireMessage(chunk)
        const waiter: ((message: DBusMessage) => void) | undefined = this.#waiters.shift()
        if (waiter) {
            waiter(message)
        } else {
            this.#pending.push(message)
        }
        callback()
    }

    /**
     * Feeds bytes to the library as incoming bus traffic.
     *
     * @param data - Raw bytes, which may contain partial or multiple messages.
     */
    public deliver(data: Buffer): void {
        this.push(data)
    }

    /**
     * Resolves with the next message the library writes to the bus.
     *
     * @returns The decoded outgoing message.
     */
    public nextOutgoing(): Promise<DBusMessage> {
        const pending: DBusMessage | undefined = this.#pending.shift()
        if (pending) return Promise.resolve(pending)
        return new Promise<DBusMessage>((resolve): number => this.#waiters.push(resolve))
    }
}
