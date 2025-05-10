import {BusAddressConnectOpts} from './BusAddressConnectOpts'
import {SocketConnectOpts} from './SocketConnectOpts'
import {TCPConnectOpts} from './TCPConnectOpts'
import {StreamConnectOpts} from './StreamConnectOpts'

export type ConnectOpts =
    BusAddressConnectOpts |
    SocketConnectOpts |
    TCPConnectOpts |
    StreamConnectOpts