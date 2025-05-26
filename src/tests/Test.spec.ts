import {SetupLocalServiceSpec} from './examples/SetupLocalService.spec'
import {InvokeDBusServiceSpec} from './examples/InvokeDBusService.spec'

/**
 * Executes test specifications for DBus service setup and invocation.
 * This script sets up a local DBus service and then invokes it using a client,
 * demonstrating both server and client interactions over a TCP connection.
 * The operations are scheduled to run immediately in the next event loop cycle.
 */
setImmediate(async (): Promise<void> => {
    // Set up a local DBus service with the specified name and TCP bus address
    await SetupLocalServiceSpec('org.dbus.node.test', 'tcp:host=192.168.1.246,port=44446')

    // Invoke the DBus service as a client to test interactions with the local service
    await InvokeDBusServiceSpec('org.dbus.node.test', 'tcp:host=192.168.1.246,port=44446')
})
