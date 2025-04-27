import {MessageBus} from './MessageBus'
import {IHandshakeOptions} from './types/IHandshakeOptions'
import {ConnectOptions, DBusConnection} from './DBusConnection'

export async function createClient(options?: ConnectOptions & IHandshakeOptions): Promise<MessageBus> {
    const connection: DBusConnection = await DBusConnection.createConnection(options || {})
    return new MessageBus(connection, options || {})
}

export async function systemBus(options?: IHandshakeOptions): Promise<MessageBus> {
    return await createClient({
        ...options,
        busAddress: process.env.DBUS_SYSTEM_BUS_ADDRESS || 'unix:path=/var/run/dbus/system_bus_socket'
    })
}

export async function sessionBus(options?: ConnectOptions & IHandshakeOptions) {
    return await createClient(options)
}