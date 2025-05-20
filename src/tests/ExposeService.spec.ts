import {LocalService} from '../LocalService'

export async function runExposeService(): Promise<void> {
    const serv = new LocalService('org.test.service')
    await serv.run({busAddress: 'tcp:host=192.168.0.96,port=44444'})
}