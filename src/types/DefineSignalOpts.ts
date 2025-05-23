import {IntrospectSignalArgument} from './IntrospectSignalArgument'
import EventEmitter from 'node:events'

export interface DefineSignalOpts {
    name: string
    args?: IntrospectSignalArgument[]
    eventEmitter: EventEmitter
}