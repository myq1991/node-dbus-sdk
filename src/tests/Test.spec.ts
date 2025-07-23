import {SetupLocalServiceSpec} from './examples/SetupLocalService.spec'
import {InvokeDBusServiceSpec} from './examples/InvokeDBusService.spec'
import {DBus} from '../NodeDBusSDK'

/**
 * Executes test specifications for DBus service setup and invocation.
 * This script sets up a local DBus service and then invokes it using a client,
 * demonstrating both server and client interactions over a TCP connection.
 * The operations are scheduled to run immediately in the next event loop cycle.
 */
// setImmediate(async (): Promise<void> => {
//     // Set up a local DBus service with the specified name and TCP bus address
//     await SetupLocalServiceSpec('org.dbus.node.test', 'tcp:host=192.168.1.127,port=44444')
//
//     // Invoke the DBus service as a client to test interactions with the local service
//     await InvokeDBusServiceSpec('org.dbus.node.test', 'tcp:host=192.168.1.127,port=44444')
// })

setImmediate(async (): Promise<void> => {
    // Set up a local DBus service with the specified name and TCP bus address
    // await SetupLocalServiceSpec('org.dbus.node.test', 'tcp:host=192.168.1.127,port=44444')

    // Invoke the DBus service as a client to test interactions with the local service
    // await InvokeDBusServiceSpec('org.dbus.node.test', 'tcp:host=192.168.1.127,port=44444')
    const dbus = await DBus.connect({busAddress: 'unix:path=/var/run/dbus/system_bus_socket'})
    // dbus.addMatch(`destination=:${dbus.uniqueName}`)
    // dbus.addMatch('destination=""')
    // dbus.addMatch('\'\'')
    // dbus.addMatch('type=\'method_return\'')
    dbus.addMatch('')
    console.log('Connect to DBus OK!',dbus.uniqueName)
    const service = await dbus.getService('org.freedesktop.login1')
    console.log('Get DBus service OK!')
    const obj = await service.getObject('/org/freedesktop/login1')
    console.log('Get DBus object OK!')
    const inter = await obj.getInterface('org.freedesktop.login1.Manager')
    console.log('Get DBus interface OK!')
    const fd = (await inter.method.Inhibit(
        'shutdown:sleep',
        'ControlServer',
        'Mode management actions',
        'delay'
    )) as number
    console.log('Run Inhibit method done!')
    console.log('fd: ' + fd)
})
