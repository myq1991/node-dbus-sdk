import {createClient} from '../NodeDBus'
import {DBus} from '../DBus'
import {DBusMethod} from '../DBusMethod'
import {DBusMethodArgumentDirection} from '../types/IDBusMethodArgument'
import {DBusInterface} from '../DBusInterface'
import {DBusObject} from '../DBusObject'
import {DBusService} from '../DBusService'

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
    // const prop=new DBusProperty('org.ptswitch.pad', '/slot1/port1/stc', 'pad.stc', 'syncState', 'i', messageBus)
    // console.log('value:',await prop.get())
    // const method = new DBusMethod('org.ptswitch.pad', '/slot1/port1/stc', 'pad.stc', 'portSetRate', [
    //     {
    //         type: 'u',
    //         name: 'rate',
    //         direction: DBusMethodArgumentDirection.IN
    //     },
    //     {
    //         type: 'i',
    //         name: 'result',
    //         direction: DBusMethodArgumentDirection.OUT
    //     }
    // ], messageBus)
    // console.log('portSetRate', await method.call(100))
    // let iface = new DBusInterface('org.ptswitch.pad', '/slot1/port1/stc', 'pad.stc', messageBus)
    // iface=await iface.init()
    // console.log(await iface.methods.portSetRate.call(100))
    // let obj=new DBusObject('org.ptswitch.pad', '/slot1/port1/stc',messageBus)
    // obj=await obj.init()
    // console.log(await obj.getInterface('pad.stc').methods.portSetRate.call(100))
    const serv = new DBusService('org.ptswitch.pad', messageBus)
    const obj=await serv.getObject('/slot1/port1/stc')
    // console.log(await obj.getInterface('pad.stc').methods.portSetRate.call(100))
})