import {DBus} from '../DBus'
import {DBusMethod} from '../DBusMethod'
import {DBusMethodArgumentDirection} from '../types/IDBusMethodArgument'
import {DBusInterface} from '../DBusInterface'
import {DBusObject} from '../DBusObject'
import {DBusService} from '../DBusService'
import {marshall} from '../lib/Marshall'

// setImmediate(async ()=>{
//     // Test array of dictionaries (a{sv})
//     const arrayDictData = [
//         [
//             { key1: ['s', 'value1'], key2: ['u', 42] },
//             { key3: ['b', 1] }
//         ]
//     ];
//     const arrayDictSignature = 'a{sv}';
//     // const arrayDictBuffer = marshall(arrayDictSignature, arrayDictData);
//     // const arrayDictBuffer = marshall(arrayDictSignature, [[{a:['s','1234']}]]);
//     const arrayDictBuffer = marshall('{sv}', [{a:1234}]);
//     console.log('Array of dictionaries buffer:', arrayDictBuffer.toString('hex'));
// })

setImmediate(async () => {
    const dbus = await DBus.connect({
        // busAddress: 'tcp:host=192.168.1.236,port=44444'
        busAddress: 'tcp:host=192.168.0.96,port=44444'
    })

    const services: string[] = await dbus.getServices()
    // console.log(services)
    const serv = dbus.getService('org.ptswitch.pad')
    // const testPad = dbus.getService('test.test.pad')
    // // console.log(await testPad.listObjects())
    // const testPadObj = await testPad.getObject('/test')
    // // console.log(testPadObj.listInterfaces())
    // const testPadObjIface = testPadObj.getInterface('test.test.pad.Interface')
    // console.log(await testPadObjIface.methods.test.call([[{a:true,b:1234,c:'1234'}]]))
    // console.log(await testPadObjIface.methods.test.call([
    //     [{index: 1}],
    //     [{enable: true}],
    //     [{sid: 1}],
    //     [{seqno: 1}],
    //     [{pktsig: 1}],
    //     [{stcsig: true}],
    //     [{type: 0}],
    //     [{loop: 0}],
    //     [{delay: 0}],
    //     [{packet: Buffer.from('AQzNAQH/ABEiM0RVgQCgzIi4EjQAcwAAAABhaYASRGV2MS9MTE4wJEdPJGdjYjAxgQEUghFEZXYxL0xMTjAkRGF0U2V0MYMIR1NfZ2NiMDGECAAAAAAAAAAAhQEAhgEAhwEAiAEBiQEAigEDqxeFAQuiC4MBAYkGESIzRFVmhwUIwEhfww==', 'base64')}],
    //     [{stcsig: true}]
    // ]))


    const obj = await serv.getObject('/slot1/port1/stc')
    // const obj = await serv.getObject('/slot1/port1/stc')
    // console.log(await obj.getInterface('pad.stc').methods.portSetRate.call(100))
    // console.log(await obj.getInterface('pad.stc').methods.portGetRate.call())

    // console.log(await obj.getInterface('pad.stc').methods.sdsSetEntry.call(
    //     1,
    //     1,
    //     1,
    //     true,
    //     true,
    //     1,
    //     0,
    //     0,
    //     0,
    //     Buffer.from('AQzNAQH/ABEiM0RVgQCgzIi4EjQAcwAAAABhaYASRGV2MS9MTE4wJEdPJGdjYjAxgQEUghFEZXYxL0xMTjAkRGF0U2V0MYMIR1NfZ2NiMDGECAAAAAAAAAAAhQEAhgEAhwEAiAEBiQEAigEDqxeFAQuiC4MBAYkGESIzRFVmhwUIwEhfww==','base64')
    // ))

    console.log(await obj.getInterface('pad.stc').methods.sdsSetEntryVec.call([
        [{index: 1}],
        [{sid: 1}],
        [{seqno: 1}],
        [{enable: true}],
        [{stcsig: true}],
        [{pktsig: 1}],
        [{type: 0}],
        [{loop: 0}],
        [{delay: 0}],
        [{packet: Buffer.from('AQzNAQH/ABEiM0RVgQCgzIi4EjQAcwAAAABhaYASRGV2MS9MTE4wJEdPJGdjYjAxgQEUghFEZXYxL0xMTjAkRGF0U2V0MYMIR1NfZ2NiMDGECAAAAAAAAAAAhQEAhgEAhwEAiAEBiQEAigEDqxeFAQuiC4MBAYkGESIzRFVmhwUIwEhfww==', 'base64')}]
    ]))
})