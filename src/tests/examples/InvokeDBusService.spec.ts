import {DBus} from '../../DBus'
import {DBusService} from '../../DBusService'
import {DBusObject} from '../../DBusObject'
import {DBusInterface} from '../../DBusInterface'

export async function InvokeDBusServiceSpec(serviceName: string, busAddress: string): Promise<void> {
    const dbus: DBus = await DBus.connect({busAddress: busAddress, advancedResponse: false})
    const objectManagerInterface: DBusInterface = await dbus.getInterface(serviceName, '/', 'org.freedesktop.DBus.ObjectManager')
    objectManagerInterface.signal
        .on('InterfacesAdded', (...args: any[]): void => {
            console.log('InterfacesAdded:', ...args)
        })
        .on('InterfacesRemoved', (...args: any[]): void => {
            console.log('InterfacesRemoved:', ...args)
        })
    const service: DBusService = await dbus.getService(serviceName)
    const object1: DBusObject = await service.getObject('/test/object1')
    const object2: DBusObject = await service.getObject('/test/object2')
    const iface1: DBusInterface = await object1.getInterface('test.iface1')
    const iface2: DBusInterface = await object2.getInterface('test.iface2')
    iface2.signal.on('TestSignal', (data: string): void => {
        console.log('TestSignal data:', data)
    })
    console.log('SayHello result:', await iface1.method.SayHello('you'))
    console.log('iface1.Timestamp:', await iface1.property.Timestamp.get())
}