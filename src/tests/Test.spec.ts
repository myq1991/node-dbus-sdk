import {SetupLocalServiceSpec} from './examples/SetupLocalService.spec'
import {InvokeDBusServiceSpec} from './examples/InvokeDBusService.spec'

setImmediate(async (): Promise<void> => {
    await SetupLocalServiceSpec('org.dbus.node.test', 'tcp:host=192.168.1.246,port=44446')
    await InvokeDBusServiceSpec('org.dbus.node.test', 'tcp:host=192.168.1.246,port=44446')
})