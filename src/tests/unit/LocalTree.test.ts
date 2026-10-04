import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import EventEmitter from 'node:events'
import {LocalService} from '../../LocalService'
import {LocalObject} from '../../LocalObject'
import {LocalInterface} from '../../LocalInterface'

function tree(): { service: LocalService, object: LocalObject, iface: LocalInterface } {
    const iface: LocalInterface = new LocalInterface('org.example.Tree')
        .defineMethod({name: 'Ping', method: (): void => undefined})
        .defineProperty({name: 'Level', type: 'u', getter: (): number => 1})
        .defineSignal({name: 'Changed', args: [{type: 's'}], eventEmitter: new EventEmitter()})
    const object: LocalObject = new LocalObject('/org/example/Tree')
    object.addInterface(iface)
    const service: LocalService = new LocalService('org.example.Tree')
    service.addObject(object)
    return {service, object, iface}
}

describe('local object tree', (): void => {
    it('lists and gets the objects of a service', (): void => {
        const {service, object} = tree()
        assert.deepEqual(service.listObjectPaths().sort(), ['/', '/org/example/Tree'])
        assert.deepEqual(service.getObjects().map((item: LocalObject): string => item.name).sort(), ['/', '/org/example/Tree'])
        assert.equal(service.getObject('/org/example/Tree'), object)
        assert.equal(service.getObject('/missing'), undefined)
    })

    it('lists and gets the interfaces of an object', (): void => {
        const {object, iface} = tree()
        assert.deepEqual(object.listInterfaceNames().sort(), ['org.example.Tree', 'org.freedesktop.DBus.Introspectable', 'org.freedesktop.DBus.Peer', 'org.freedesktop.DBus.Properties'])
        assert.ok(object.getInterfaces().includes(iface))
        assert.equal(object.getInterface('org.example.Tree'), iface)
        assert.equal(object.getInterface('org.example.Missing'), undefined)
    })

    it('lists the members of an interface', (): void => {
        const {iface} = tree()
        assert.deepEqual(iface.listMethodNames(), ['Ping'])
        assert.deepEqual(iface.listPropertyNames(), ['Level'])
        assert.deepEqual(iface.listSignalNames(), ['Changed'])
    })

    it('links objects and interfaces to their parents read-only', (): void => {
        const {service, object, iface} = tree()
        assert.equal(object.service, service)
        assert.equal(iface.object, object)
        assert.throws((): void => {
            (object as any).service = undefined
        }, TypeError)
        assert.throws((): void => {
            (iface as any).object = undefined
        }, TypeError)
        assert.throws((): void => {
            (service as any).dbus = undefined
        }, TypeError)
    })

    it('unlinks an object when it is removed', (): void => {
        const {service, object} = tree()
        service.removeObject(object)
        assert.equal(object.service, undefined)
        assert.equal(service.getObject('/org/example/Tree'), undefined)
    })
})
