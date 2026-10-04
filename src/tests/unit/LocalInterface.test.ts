import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {LocalInterface} from '../../LocalInterface'
import {LocalObject} from '../../LocalObject'
import {DBusPropertyAccess} from '../../lib/enums/DBusPropertyAccess'
import {
    LocalInterfaceInvalidMethodNameError,
    LocalInterfaceInvalidNameError,
    LocalInterfaceMethodDefinedError
} from '../../lib/Errors'
import {knownBug} from '../helpers/KnownBug'
import {catchUnhandledRejections} from '../helpers/Async'
import {CreateDBusError} from '../../lib/CreateDBusError'
import {MethodCallContext} from '../../types/MethodCallContext'
import {DBusMessage} from '../../lib/DBusMessage'

function createInterface(): LocalInterface {
    let label: string = 'initial'
    return new LocalInterface('org.example.Test')
        .defineMethod({
            name: 'Add',
            inputArgs: [{name: 'a', type: 'i'}, {name: 'b', type: 'i'}],
            outputArgs: [{name: 'sum', type: 'i'}],
            method: (a: number, b: number): number => a + b
        })
        .defineMethod({
            name: 'Fail',
            method: (): never => {
                throw new Error('failure inside handler')
            }
        })
        .defineProperty({
            name: 'Label',
            type: 's',
            getter: (): string => label,
            setter: (value: string): void => {
                label = value
            }
        })
        .defineProperty({
            name: 'Version',
            type: 'u',
            getter: (): number => 3
        })
}

describe('LocalInterface', (): void => {

    describe('callMethod', (): void => {
        it('calls the handler and returns the output signature', async (): Promise<void> => {
            assert.deepEqual(await createInterface().callMethod('Add', 'ii', 2, 3), {signature: 'i', result: 5})
        })

        it('rejects an incompatible input signature', async (): Promise<void> => {
            await assert.rejects(createInterface().callMethod('Add', 'ss', 'a', 'b'), {name: 'org.freedesktop.DBus.Error.InvalidArgs'})
        })

        it('rejects an unknown method', async (): Promise<void> => {
            await assert.rejects(createInterface().callMethod('Missing', ''), {name: 'org.freedesktop.DBus.Error.UnknownMethod'})
        })

        it('propagates errors thrown by the handler', async (): Promise<void> => {
            await assert.rejects(createInterface().callMethod('Fail', ''), {message: 'failure inside handler'})
        })
    })

    describe('properties', (): void => {
        it('reads and writes through getter and setter', async (): Promise<void> => {
            const iface: LocalInterface = createInterface()
            await iface.setProperty('Label', 'changed')
            assert.equal(iface.getProperty('Label'), 'changed')
        })

        it('rejects a value that does not match the property type', async (): Promise<void> => {
            await assert.rejects(createInterface().setProperty('Label', {not: 'a string'}), {name: 'org.freedesktop.DBus.Error.InvalidArgs'})
        })

        it('rejects writing a read-only property', async (): Promise<void> => {
            await assert.rejects(createInterface().setProperty('Version', 4), {name: 'org.freedesktop.DBus.Error.PropertyReadOnly'})
        })

        it('rejects an unknown property', (): void => {
            assert.throws((): any => createInterface().getProperty('Missing'), {name: 'org.freedesktop.DBus.Error.UnknownProperty'})
        })

        it('reports access modes in introspection data', (): void => {
            const access: Record<string, DBusPropertyAccess> = {}
            createInterface().introspectInterface.property.forEach((property): DBusPropertyAccess => access[property.name] = property.access)
            assert.deepEqual(access, {Label: DBusPropertyAccess.READWRITE, Version: DBusPropertyAccess.READ})
        })
    })

    describe('call context', (): void => {
        function createContextInterface(): LocalInterface {
            return new LocalInterface('org.example.Context').defineMethod({
                name: 'Inspect',
                inputArgs: [{name: 'value', type: 'u'}],
                outputArgs: [{type: 's'}],
                withContext: true,
                method: (value: number, context?: MethodCallContext): string => `${value} from ${context ? context.sender : 'nobody'}`
            })
        }

        it('passes the context given to invokeMethod after the arguments', async (): Promise<void> => {
            const context: MethodCallContext = {sender: ':1.7', objectPath: '/o', interface: 'org.example.Context', method: 'Inspect', message: new DBusMessage({serial: 1})}
            assert.deepEqual(await createContextInterface().invokeMethod('Inspect', 'u', [3], context), {signature: 's', result: '3 from :1.7'})
        })

        it('passes undefined as context when the method is called directly', async (): Promise<void> => {
            assert.deepEqual(await createContextInterface().callMethod('Inspect', 'u', 3), {signature: 's', result: '3 from nobody'})
        })

        it('does not pass a context to methods defined without withContext', async (): Promise<void> => {
            const received: any[][] = []
            const iface: LocalInterface = new LocalInterface('org.example.Plain').defineMethod({name: 'Args', inputArgs: [{type: 'u'}], method: (...args: any[]): number => received.push(args)})
            await iface.invokeMethod('Args', 'u', [3], {sender: ':1.7', objectPath: '/o', interface: 'org.example.Plain', method: 'Args', message: new DBusMessage({serial: 1})})
            assert.deepEqual(received, [[3]])
        })
    })

    describe('setter errors', (): void => {
        function createValidatingInterface(): { iface: LocalInterface, state: { value: string } } {
            const state: { value: string } = {value: 'initial'}
            const iface: LocalInterface = new LocalInterface('org.example.Validating')
                .defineProperty({
                    name: 'SyncChecked',
                    type: 's',
                    emitPropertiesChanged: true,
                    getter: (): string => state.value,
                    setter: (value: string): void => {
                        if (value === 'invalid') throw CreateDBusError('org.example.Error.Invalid', 'rejected synchronously')
                        state.value = value
                    }
                })
                .defineProperty({
                    name: 'AsyncChecked',
                    type: 's',
                    emitPropertiesChanged: true,
                    getter: (): string => state.value,
                    setter: async (value: string): Promise<void> => {
                        await new Promise<void>((resolve): NodeJS.Immediate => setImmediate(resolve))
                        if (value === 'invalid') throw CreateDBusError('org.example.Error.Invalid', 'rejected asynchronously')
                        state.value = value
                    }
                })
            return {iface, state}
        }

        it('surfaces errors thrown by a synchronous setter', async (): Promise<void> => {
            const {iface} = createValidatingInterface()
            const {result, unhandled} = await catchUnhandledRejections(async (): Promise<void> => iface.setProperty('SyncChecked', 'invalid'))
            assert.equal(result.status, 'rejected')
            assert.equal((result as PromiseRejectedResult).reason.message, 'rejected synchronously')
            assert.deepEqual(unhandled, [])
        })

        it('surfaces errors from an asynchronous setter instead of leaving them unhandled', async (): Promise<void> => {
            const {iface} = createValidatingInterface()
            const {result, unhandled} = await catchUnhandledRejections(async (): Promise<void> => iface.setProperty('AsyncChecked', 'invalid'))
            assert.deepEqual(unhandled, [])
            assert.equal(result.status, 'rejected')
            assert.equal((result as PromiseRejectedResult).reason.name, 'org.example.Error.Invalid')
        })

        it('completes an asynchronous setter before reporting success', async (): Promise<void> => {
            const {iface, state} = createValidatingInterface()
            await iface.setProperty('AsyncChecked', 'valid')
            assert.equal(state.value, 'valid')
        })
    })

    describe('write-only properties', (): void => {
        it('can be added to an object', (): void => {
            const iface: LocalInterface = new LocalInterface('org.example.WriteOnly').defineProperty({name: 'Secret', type: 's', setter: (): void => undefined})
            assert.doesNotThrow((): boolean => new LocalObject('/org/example/WriteOnly').addInterface(iface))
        })
    })

    describe('definition validation', (): void => {
        it('rejects invalid interface names', (): void => {
            for (const name of ['', 'nodots', '.leading', 'trailing.', 'double..dot', '1digit.start']) {
                assert.throws((): LocalInterface => new LocalInterface(name), LocalInterfaceInvalidNameError, name)
            }
        })

        it('rejects invalid method names', (): void => {
            assert.throws((): LocalInterface => new LocalInterface('org.example.Test').defineMethod({name: 'has.dot', method: (): void => undefined}), LocalInterfaceInvalidMethodNameError)
        })

        it('rejects defining the same method twice', (): void => {
            assert.throws((): LocalInterface => createInterface().defineMethod({name: 'Add', method: (): void => undefined}), LocalInterfaceMethodDefinedError)
        })
    })
})
