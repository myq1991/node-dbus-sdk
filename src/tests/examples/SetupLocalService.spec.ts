import {LocalService} from '../../LocalService'
import {LocalObject} from '../../LocalObject'
import {LocalInterface} from '../../LocalInterface'
import EventEmitter from 'node:events'

/**
 * Sets up a local DBus service for testing or demonstration purposes.
 * Creates a service with multiple objects and interfaces, defines methods, properties, and signals,
 * and starts the service on the specified bus address. This function simulates a local DBus service
 * with dynamic behavior such as signal emission and interface toggling.
 *
 * @param serviceName - The name of the local service to be created and registered on the DBus.
 * @param busAddress - The DBus bus address to connect to for running the local service.
 * @returns A Promise that resolves when the local service setup is complete.
 */
export async function SetupLocalServiceSpec(serviceName: string, busAddress: string): Promise<void> {
    // Initialize a variable to store a name for demonstration purposes in a property
    let yourName: string = 'Hello Kitty'

    // Create an EventEmitter to simulate periodic signal emission for testing
    const eventEmitter: EventEmitter = new EventEmitter()
    // Set up an interval to emit a 'TestSignal' event every second with the current timestamp
    setInterval((): void => {
        eventEmitter.emit('TestSignal', new Date().toString())
    }, 1000)

    // Create a local DBus service with the specified service name
    const service: LocalService = new LocalService(serviceName)

    // Create two local DBus objects with different object paths for testing multiple object interactions
    const object1: LocalObject = new LocalObject('/test/object1')
    const object2: LocalObject = new LocalObject('/test/object2')

    // Create two local DBus interfaces to define different sets of methods, properties, and signals
    const iface1: LocalInterface = new LocalInterface('test.iface1')
    const iface2: LocalInterface = new LocalInterface('test.iface2')

    // Define methods and properties on the first interface (iface1)
    iface1
        .defineMethod({
            name: 'SayHello', // Method name for greeting a user
            inputArgs: [{
                name: 'name', // Input argument for the user's name
                type: 's'     // Type 's' indicates a string
            }],
            outputArgs: [{
                type: 's'     // Output type is also a string
            }],
            method: async (input: string): Promise<string> => {
                return `Hello! ${input}` // Return a greeting message with the provided name
            }
        })
        .defineMethod({
            name: 'GetTime', // Method name for getting the current time
            outputArgs: [{
                name: 'ts',   // Output argument for timestamp
                type: 's'     // Type 's' indicates a string
            }],
            method: async (): Promise<string> => `Now: ${new Date().toString()}` // Return the current timestamp as a string
        })

    // Define properties on the first interface (iface1)
    iface1
        .defineProperty({
            name: 'Timestamp', // Property name for current timestamp
            type: 'x',         // Type 'x' indicates a 64-bit integer
            getter: () => Date.now() // Getter returns the current timestamp in milliseconds
        })
        .defineProperty({
            name: 'YourName',  // Property name for a user-defined name
            type: 's',         // Type 's' indicates a string
            getter: (): string => yourName, // Getter returns the current value of yourName
            setter: (name: string): void => {
                yourName = name // Setter updates the value of yourName
            }
        })

    // Define a signal and a method on the second interface (iface2)
    iface2
        .defineSignal({
            name: 'TestSignal', // Signal name for periodic test signal emission
            args: [{
                name: 'value',  // Argument for the signal value
                type: 's'       // Type 's' indicates a string
            }],
            eventEmitter: eventEmitter // Associate the signal with the EventEmitter for periodic emission
        })

    iface2.defineMethod({
        name: 'InterfaceSleep', // Method name for toggling interface availability
        inputArgs: [{
            name: 'seconds',    // Input argument for sleep duration in seconds
            type: 'i'           // Type 'i' indicates a 32-bit integer
        }],
        outputArgs: [{
            name: 'result',     // Output argument for the result status
            type: 's'           // Type 's' indicates a string
        }],
        method: (seconds: number): string => {
            setImmediate((): void => {
                object2.removeInterface(iface2) // Remove iface2 from object2 immediately
                setTimeout((): void => {
                    object2.addInterface(iface2) // Re-add iface2 to object2 after the specified seconds
                }, seconds * 1000)
            })
            return 'OK' // Return confirmation of the operation
        }
    })

    // Start the local service on the specified bus address
    await service.run({busAddress: busAddress})
    // Wait briefly to ensure the service starts properly
    await new Promise<void>(resolve => setTimeout(resolve, 1000))

    // Add the first object to the service with a delay for staged setup
    service.addObject(object1)
    await new Promise<void>(resolve => setTimeout(resolve, 1000))

    // Add the second object to the service with a delay for staged setup
    service.addObject(object2)
    await new Promise<void>(resolve => setTimeout(resolve, 1000))

    // Add the first interface to the first object with a delay for staged setup
    object1.addInterface(iface1)
    await new Promise<void>(resolve => setTimeout(resolve, 1000))

    // Add the second interface to the second object with a delay for staged setup
    object2.addInterface(iface2)
    await new Promise<void>(resolve => setTimeout(resolve, 1000))

    // Log a message to confirm the local service has started completely
    console.info(`Local service ${serviceName} startup completely`)
}
