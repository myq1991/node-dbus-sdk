import {Duplex} from 'node:stream'

export interface IDbusStreamConnectOptions {
    stream: Duplex
}