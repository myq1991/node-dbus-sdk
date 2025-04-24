import {createHash, randomBytes} from 'crypto'
import {readFile, stat} from 'fs/promises'
import {join as pathJoin} from 'path'
import {ReadLine} from './ReadLine'
import * as constants from './Constants'
import {BinaryLike, Hash} from 'node:crypto'
import {Duplex} from 'node:stream'
import {Stats} from 'node:fs'

function sha1(input: BinaryLike): string {
    let sha1: Hash = createHash('sha1')
    sha1.update(input)
    return sha1.digest('hex')
}

function getUserHome(): string {
    return process.env[process.platform.match(/\$win/) ? 'USERPROFILE' : 'HOME'] as string
}

async function getCookie(context: string, id: string): Promise<string> {
    // http://dbus.freedesktop.org/doc/dbus-specification.html#auth-mechanisms-sha

    let dirname: string = pathJoin(getUserHome(), '.dbus-keyrings')
    // > There is a default context, "org_freedesktop_general" that's used by servers that do not specify otherwise.
    if (context.length === 0) context = 'org_freedesktop_general'

    let filename: string = pathJoin(dirname, context)
    const s: Stats = await stat(dirname)
    // check it's not writable by others and readable by user
    if (s.mode & 0o22) {
        throw new Error('User keyrings directory is writeable by other users. Aborting authentication')
    }

    if (process.hasOwnProperty('getuid') && s.uid !== process.getuid!()) {
        throw new Error('Keyrings directory is not owned by the current user. Aborting authentication!')
    }
    const keyrings: string = await readFile(filename, {encoding: 'ascii'})

    const lines: string[] = keyrings.split('\n')
    for (let l: number = 0; l < lines.length; ++l) {
        let data: string[] = lines[l].split(' ')
        if (data.length > 2 && id === data[0]) return data[2]
    }
    throw new Error('cookie not found')
}

function hexlify(input: string | number): string {
    return Buffer.from(input.toString(), 'ascii').toString('hex')
}

export interface Opts {
    authMethods?: string[]
    uid?: number
    // Set false to enable more verbose objects
    simple?: boolean
}

export async function clientHandshake(stream: Duplex, opts?: Opts): Promise<string> {
    let authMethods: string[] = opts?.authMethods || constants.defaultAuthMethods
    stream.write('\0')
    let uid: number = opts?.uid!
    if (typeof uid === 'undefined') {
        uid = process?.hasOwnProperty('getuid') ? process.getuid!() : 0
    }
    let id: string = hexlify(uid)
    let lastErr: Error = new Error('no auth methods available')
    for (let m of authMethods) {
        try {
            return await tryAuth(stream, m, id)
        } catch (e: any) {
            lastErr = e
        }
    }
    throw lastErr
}

async function tryAuth(stream: Duplex, authMethod: string, id: string): Promise<string> {
    const successAndBegin: () => Promise<string> = async (): Promise<string> => {
        const line: Buffer = await ReadLine(stream)
        const ok: RegExpMatchArray | null = line.toString('ascii').match(/^([A-Za-z]+) (.*)/)
        if (ok && ok.length > 2 && ok[1] === 'OK') {
            stream.write('BEGIN\r\n')
            return ok[2] // ok[2] = guid. Do we need it?
        }
        throw new Error(line.toString('ascii'))
    }
    switch (authMethod) {
        case 'EXTERNAL':
            stream.write(`AUTH ${authMethod} ${id}\r\n`)
            return await successAndBegin()
        case 'DBUS_COOKIE_SHA1':
            stream.write(`AUTH ${authMethod} ${id}\r\n`)
            const line: Buffer = await ReadLine(stream)
            let data: string[] = Buffer.from(line.toString().split(' ')[1].trim(), 'hex')
                .toString().split(' ')
            let cookieContext: string = data[0]
            let cookieId: string = data[1]
            let serverChallenge = data[2]
            // any random 16 bytes should work, sha1(rnd) to make it simplier
            let clientChallenge: string = randomBytes(16).toString('hex')
            let cookie: string = await getCookie(cookieContext, cookieId)
            let response: string = sha1([serverChallenge, clientChallenge, cookie].join(':'))
            let reply: string = hexlify(clientChallenge + response)
            stream.write(`DATA ${reply}\r\n`)
            return await successAndBegin()
        case 'ANONYMOUS':
            stream.write('AUTH ANONYMOUS \r\n')
            return await successAndBegin()
        default:
            throw new Error(`Unsupported auth method: ${authMethod}`)
    }
}
