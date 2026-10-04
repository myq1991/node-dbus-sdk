import EventEmitter from 'node:events'
import {LocalService} from '../../LocalService'
import {LocalObject} from '../../LocalObject'
import {LocalInterface} from '../../LocalInterface'
import {CreateDBusError} from '../../lib/CreateDBusError'
import {MethodCallContext} from '../../types/MethodCallContext'
import {DBusUint32} from '../../lib/datatypes/DBusUint32'
import {DBusVariant} from '../../lib/datatypes/DBusVariant'

export const TEST_OBJECT_PATH: string = '/org/example/Object'

export const TEST_INTERFACE: string = 'org.example.Test'

export interface TestService {
    service: LocalService
    /**
     * Emitting `Tick` on this emitter broadcasts the Tick signal.
     */
    signals: EventEmitter
    state: { label: string, plain: string, checked: string, sleeping: number }
}

/**
 * Builds a LocalService exposing one object with methods, properties and a signal covering the common DBus types.
 *
 * @param name - Well-known bus name for the service.
 * @returns The (not yet running) service and handles to its state.
 */
export function createTestService(name: string): TestService {
    const state: { label: string, plain: string, checked: string, sleeping: number } = {label: 'initial', plain: 'initial', checked: 'initial', sleeping: 0}
    const signals: EventEmitter = new EventEmitter()
    const iface: LocalInterface = new LocalInterface(TEST_INTERFACE)
        .defineMethod({
            name: 'Add',
            inputArgs: [{name: 'a', type: 'i'}, {name: 'b', type: 'i'}],
            outputArgs: [{name: 'sum', type: 'i'}],
            method: (a: number, b: number): number => a + b
        })
        .defineMethod({
            name: 'EchoVariant',
            inputArgs: [{name: 'value', type: 'v'}],
            outputArgs: [{name: 'value', type: 'v'}],
            method: (value: any): any => value
        })
        .defineMethod({
            name: 'EchoDict',
            inputArgs: [{name: 'value', type: 'a{sv}'}],
            outputArgs: [{name: 'value', type: 'a{sv}'}],
            method: (value: Record<string, any>): Record<string, any> => value
        })
        .defineMethod({
            name: 'EchoInt64Array',
            inputArgs: [{name: 'value', type: 'ax'}],
            outputArgs: [{name: 'value', type: 'ax'}],
            method: (value: bigint[]): bigint[] => value
        })
        .defineMethod({
            name: 'EchoBytes',
            inputArgs: [{name: 'value', type: 'ay'}],
            outputArgs: [{name: 'value', type: 'ay'}],
            method: (value: Buffer): Buffer => value
        })
        .defineMethod({
            name: 'DivMod',
            inputArgs: [{name: 'dividend', type: 'i'}, {name: 'divisor', type: 'i'}],
            outputArgs: [{name: 'quotient', type: 'i'}, {name: 'remainder', type: 'i'}],
            method: (dividend: number, divisor: number): number[] => [Math.trunc(dividend / divisor), dividend % divisor]
        })
        .defineMethod({
            name: 'TypedUint32',
            outputArgs: [{name: 'value', type: 'u'}],
            method: (): DBusUint32 => new DBusUint32(4000000000)
        })
        .defineMethod({
            name: 'TypedVariant',
            outputArgs: [{name: 'value', type: 'v'}],
            method: (): DBusVariant => new DBusVariant(new DBusUint32(7))
        })
        .defineMethod({
            name: 'Caller',
            inputArgs: [{name: 'label', type: 's'}],
            outputArgs: [{name: 'label', type: 's'}, {name: 'sender', type: 's'}, {name: 'path', type: 'o'}, {name: 'method', type: 's'}],
            withContext: true,
            method: (label: string, context: MethodCallContext): [string, string, string, string] => [label, context.sender, context.objectPath, context.method]
        })
        .defineMethod({
            name: 'Sleep',
            inputArgs: [{name: 'milliseconds', type: 'u'}],
            outputArgs: [{name: 'milliseconds', type: 'u'}],
            method: async (milliseconds: number): Promise<number> => {
                state.sleeping++
                try {
                    await new Promise<void>((resolve): NodeJS.Timeout => setTimeout(resolve, milliseconds))
                    return milliseconds
                } finally {
                    state.sleeping--
                }
            }
        })
        .defineMethod({
            name: 'Fail',
            method: (): never => {
                throw CreateDBusError('org.example.Error.Boom', 'boom')
            }
        })
        .defineProperty({
            name: 'Label',
            type: 's',
            emitPropertiesChanged: true,
            getter: (): string => state.label,
            setter: (value: string): void => {
                state.label = value
            }
        })
        .defineProperty({
            name: 'Plain',
            type: 's',
            getter: (): string => state.plain,
            setter: (value: string): void => {
                state.plain = value
            }
        })
        .defineProperty({
            name: 'Checked',
            type: 's',
            emitPropertiesChanged: true,
            getter: (): string => state.checked,
            setter: async (value: string): Promise<void> => {
                if (value === 'invalid') throw CreateDBusError('org.example.Error.Invalid', 'value rejected by validation')
                state.checked = value
            }
        })
        .defineProperty({
            name: 'Version',
            type: 'u',
            getter: (): number => 3
        })
        .defineSignal({
            name: 'Tick',
            args: [{name: 'count', type: 'u'}],
            eventEmitter: signals
        })
    const object: LocalObject = new LocalObject(TEST_OBJECT_PATH)
    object.addInterface(iface)
    const service: LocalService = new LocalService(name)
    service.addObject(object)
    return {service, signals, state}
}
