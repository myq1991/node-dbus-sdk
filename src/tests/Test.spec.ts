import {createClient} from '../NodeDBus'
import {DBusService} from '../DBusService'
import {DBus} from '../DBus'
import {DBusProperty} from '../DBusProperty'

setImmediate(async () => {
    const messageBus = await createClient({
        busAddress: 'tcp:host=192.168.1.236,port=44444'
    })
    console.log(messageBus)
    const dbus = new DBus(messageBus)
    await dbus.init()
    // const serv=new DBusService('org.freedesktop.DBus',messageBus)
    // const serv=new DBusService('org.ptswitch.pad',messageBus)
    // console.log(await serv.getServiceObjectPaths())
    // const prop=new DBusProperty('org.ptswitch.pad', '/slot1/port1/stc', 'pad.stc', 'online', 'i', messageBus)
    const prop=new DBusProperty('org.ptswitch.pad', '/slot1/port1/stc', 'pad.stc', 'syncState', 'i', messageBus)
    console.log('value:',await prop.get())
})