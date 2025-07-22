import {DBus} from '../../DBus'
import {DBusService} from '../../DBusService'
import {DBusObject} from '../../DBusObject'
import {DBusInterface} from '../../DBusInterface'

/**
 * Invokes a DBus service for testing or demonstration purposes.
 * Connects to a specified DBus service on a given bus address, sets up listeners for object manager signalsEjemplo: signals,
 * retrieves service objects and interfaces, and interacts with them by calling methods and accessing properties.
 * This function simulates a client interacting with a remote DBus service.
 *
 * @param serviceName - The name of the DBus service to connect to and interact with.
 * @param busAddress - The DBus bus address to connect to for accessing the service.
 * @returns A Promise that resolves when the interaction with the DBus service is complete.
 */
export async function InvokeDBusServiceSpec(serviceName: string, busAddress: string): Promise<void> {
    // Connect to the DBus at the specified bus address, disabling advanced response handling
    const dbus: DBus = await DBus.connect({
        busAddress: busAddress,
        advancedResponse: false,
        convertBigIntToNumber: true
    })

    // Get the ObjectManager interface for the specified service at the root path
    const objectManagerInterface: DBusInterface = await dbus.getInterface(serviceName, '/', 'org.freedesktop.DBus.ObjectManager')

    // Set up listeners for ObjectManager signals to monitor interface additions and removals
    objectManagerInterface.signal
        .on('InterfacesAdded', (...args: any[]): void => {
            console.log('InterfacesAdded:', ...args) // Log when interfaces are added to an object
        })
        .on('InterfacesRemoved', (...args: any[]): void => {
            console.log('InterfacesRemoved:', ...args) // Log when interfaces are removed from an object
        })

    // Retrieve the specified service from the DBus connection
    const service: DBusService = await dbus.getService(serviceName)

    // Get two objects from the service at specified paths for testing interactions
    const object1: DBusObject = await service.getObject('/test/object1')
    const object2: DBusObject = await service.getObject('/test/object2')

    // Retrieve interfaces from the objects to interact with their methods, properties, and signals
    const iface1: DBusInterface = await object1.getInterface('test.iface1')
    const iface2: DBusInterface = await object2.getInterface('test.iface2')

    // Set up a listener for a test signal on the second interface
    iface2.signal.on('TestSignal', (data: string): void => {
        console.log('TestSignal data:', data) // Log data received from the TestSignal
    })

    // Call a method on the first interface and log the result
    console.log('SayHello result:', await iface1.method.SayHello('you'))

    // Access and log a property value from the first interface
    console.log('iface1.Timestamp:', await iface1.property.Timestamp.get())
}
