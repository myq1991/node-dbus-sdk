import {DBus} from '../DBus'

setImmediate(async (): Promise<void> => {
    await DBus.connect({busAddress:'tcp:host=192.168.1.236,port=44444'})
    console.log('success')
})