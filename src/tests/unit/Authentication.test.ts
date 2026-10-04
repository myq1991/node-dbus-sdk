import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {Duplex} from 'node:stream'
import {DBusConnection} from '../../lib/DBusConnection'
import {AuthError, UserPermissionError} from '../../lib/Errors'
import {withTimeout} from '../helpers/Async'
import {knownBug} from '../helpers/KnownBug'

const COOKIE_CONTEXT: string = 'org_freedesktop_general'
const COOKIE_ID: string = '1234'
const COOKIE: string = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4'
const SERVER_CHALLENGE: string = '5f9a1c3e7b2d4f6a8c0e2b4d6f8a0c2e'

/**
 * Server side of the DBUS_COOKIE_SHA1 mechanism, implemented from the specification: it challenges the client and
 * accepts only a response of the form hex("<client challenge> <sha1(server challenge:client challenge:cookie)>").
 */
class CookieAuthServer extends Duplex {

    public responses: string[] = []

    #buffer: string = ''

    public _read(): void {
        // Replies are pushed when a complete line has been written
    }

    public _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        this.#buffer += chunk.toString('ascii').replace(/^\0/, '')
        let newline: number
        while ((newline = this.#buffer.indexOf('\r\n')) >= 0) {
            this.#handle(this.#buffer.substring(0, newline))
            this.#buffer = this.#buffer.substring(newline + 2)
        }
        callback()
    }

    #handle(line: string): void {
        if (line.startsWith('AUTH DBUS_COOKIE_SHA1 ')) {
            return void this.push(`DATA ${Buffer.from(`${COOKIE_CONTEXT} ${COOKIE_ID} ${SERVER_CHALLENGE}`).toString('hex')}\r\n`)
        }
        if (line.startsWith('AUTH ')) return void this.push('REJECTED DBUS_COOKIE_SHA1\r\n')
        if (line.startsWith('DATA ')) {
            const response: string = Buffer.from(line.substring(5), 'hex').toString('ascii')
            this.responses.push(response)
            const match: RegExpExecArray | null = /^(\S+) ([0-9a-f]{40})$/.exec(response)
            const expected: string | undefined = match ? createHash('sha1').update(`${SERVER_CHALLENGE}:${match[1]}:${COOKIE}`).digest('hex') : undefined
            return void this.push(match && match[2] === expected ? 'OK 0123456789abcdef0123456789abcdef\r\n' : 'REJECTED DBUS_COOKIE_SHA1\r\n')
        }
    }
}

describe('authentication internals', (): void => {
    let home: string
    let originalHome: string | undefined

    before((): void => {
        originalHome = process.env.HOME
        home = mkdtempSync(path.join(tmpdir(), 'dbus-sdk-auth-'))
        mkdirSync(path.join(home, '.dbus-keyrings'), {mode: 0o700})
        writeFileSync(path.join(home, '.dbus-keyrings', COOKIE_CONTEXT), `${COOKIE_ID} 1700000000 ${COOKIE}\n`, {mode: 0o600})
        process.env.HOME = home
    })

    after((): void => {
        process.env.HOME = originalHome
        rmSync(home, {recursive: true, force: true})
    })

    describe('DBUS_COOKIE_SHA1', (): void => {
        it('answers the challenge in the format the specification requires', async (): Promise<void> => {
            const server: CookieAuthServer = new CookieAuthServer()
            const handshake: Promise<DBusConnection> = withTimeout(DBusConnection.createConnection({stream: server, authMethods: ['DBUS_COOKIE_SHA1']}), 2000, 'handshake')
            await handshake.catch((): void => undefined)
            assert.match(server.responses[0], /^\S+ [0-9a-f]{40}$/, 'expected "<client challenge> <sha1 hex>"')
            await handshake
        })

        it('reads the cookie from the keyring', async (): Promise<void> => {
            assert.equal(await (DBusConnection as any).getCookie(COOKIE_CONTEXT, COOKIE_ID), COOKIE)
        })

        it('uses the default context when the server sends an empty one', async (): Promise<void> => {
            assert.equal(await (DBusConnection as any).getCookie('', COOKIE_ID), COOKIE)
        })

        it('fails when the cookie id is unknown', async (): Promise<void> => {
            await assert.rejects((DBusConnection as any).getCookie(COOKIE_CONTEXT, '9999'), UserPermissionError)
        })

        it('refuses a keyring directory writable by others', async (): Promise<void> => {
            const keyrings: string = path.join(home, '.dbus-keyrings')
            chmodSync(keyrings, 0o777)
            try {
                await assert.rejects((DBusConnection as any).getCookie(COOKIE_CONTEXT, COOKIE_ID), UserPermissionError)
            } finally {
                chmodSync(keyrings, 0o700)
            }
        })
    })

    describe('handshake', (): void => {
        it('rejects with AuthError when the server rejects every mechanism', async (): Promise<void> => {
            const server: CookieAuthServer = new CookieAuthServer()
            await assert.rejects(withTimeout(DBusConnection.createConnection({stream: server, authMethods: ['EXTERNAL', 'ANONYMOUS']}), 2000, 'handshake'), AuthError)
        })
    })

    describe('home directory', (): void => {
        it('uses USERPROFILE on Windows', knownBug('the platform check matches the literal "$win", so Windows never uses USERPROFILE'), (): void => {
            const platform: PropertyDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')!
            const originalProfile: string | undefined = process.env.USERPROFILE
            Object.defineProperty(process, 'platform', {value: 'win32'})
            process.env.USERPROFILE = 'C:\\Users\\example'
            try {
                assert.equal((DBusConnection as any).getUserHome(), 'C:\\Users\\example')
            } finally {
                Object.defineProperty(process, 'platform', platform)
                if (originalProfile === undefined) {
                    delete process.env.USERPROFILE
                } else {
                    process.env.USERPROFILE = originalProfile
                }
            }
        })
    })
})
