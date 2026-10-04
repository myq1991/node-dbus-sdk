import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {DBus} from '../../DBus'
import {DBusObjectManager} from '../../DBusObjectManager'
import {DBusConnection} from '../../lib/DBusConnection'
import {DBusMessage} from '../../lib/DBusMessage'
import {DBusMessageType} from '../../lib/enums/DBusMessageType'
import {DBusMessageFlags} from '../../lib/enums/DBusMessageFlags'
import {DBusSignedValue} from '../../lib/DBusSignedValue'
import {MockBusStream} from '../helpers/MockBusStream'

const SERVICE: string = ':1.9'

function signal(serial: number, path: string, iface: string, member: string, signature: string, ...args: any[]): Buffer {
    return DBusMessage.encode({serial, type: DBusMessageType.SIGNAL, flags: DBusMessageFlags.NO_REPLY_EXPECTED, sender: SERVICE, path, interfaceName: iface, member, signature}, ...args)
}

function device(level: number): Record<string, Record<string, DBusSignedValue>> {
    return {'org.example.Device1': {Level: new DBusSignedValue('u', level)}}
}

/**
 * Ordering of GetManagedObjects and the signals around it, with the bus simulated: the reply and the signals the
 * service sent right before and after it arrive in one chunk, as they can on a real socket.
 */
describe('DBusObjectManager loading', (): void => {
    it('applies exactly the signals the service sent after its GetManagedObjects reply', async (): Promise<void> => {
        const stream: MockBusStream = new MockBusStream()
        const dbus: DBus = new DBus(new DBusConnection(stream, 'EXTERNAL', '0', 'guid'))
        const manager: DBusObjectManager = new DBusObjectManager({dbus, service: SERVICE, uniqueName: SERVICE, objectPath: '/'})
        const events: any[][] = []
        for (const event of ['objectAdded', 'objectRemoved', 'propertiesChanged']) manager.on(event, (...args: any[]): void => void events.push([event, args[0]]))
        const loaded: Promise<void> = manager.load()

        let call: DBusMessage
        do {
            call = await stream.nextOutgoing()
        } while (call.header.member !== 'GetManagedObjects')

        stream.deliver(Buffer.concat([
            // Before the reply, so already reflected in it: /x appeared and went away again
            signal(10, '/', 'org.freedesktop.DBus.ObjectManager', 'InterfacesAdded', 'oa{sa{sv}}', '/x', device(1)),
            signal(11, '/', 'org.freedesktop.DBus.ObjectManager', 'InterfacesRemoved', 'oas', '/x', ['org.example.Device1']),
            DBusMessage.encode({serial: 12, type: DBusMessageType.METHOD_RETURN, flags: DBusMessageFlags.NO_REPLY_EXPECTED, sender: SERVICE, replySerial: call.header.serial, signature: 'a{oa{sa{sv}}}'}, {'/a': device(1)}),
            // After the reply: to be applied on top of it
            signal(13, '/', 'org.freedesktop.DBus.ObjectManager', 'InterfacesAdded', 'oa{sa{sv}}', '/b', device(2)),
            signal(14, '/a', 'org.freedesktop.DBus.Properties', 'PropertiesChanged', 'sa{sv}as', 'org.example.Device1', {Level: new DBusSignedValue('u', 5)}, [])
        ]))
        await loaded

        assert.deepEqual(manager.getManagedObjects(), {'/a': {'org.example.Device1': {Level: 5}}, '/b': {'org.example.Device1': {Level: 2}}})
        assert.deepEqual(events, [['objectAdded', '/a'], ['objectAdded', '/b'], ['propertiesChanged', '/a']])
        manager.close()
    })
})
