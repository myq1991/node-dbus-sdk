import {IntrospectMethod} from './IntrospectMethod'
import {IntrospectProperty} from './IntrospectProperty'
import {IntrospectSignal} from './IntrospectSignal'

export interface IntrospectInterface {
    name: string
    method: IntrospectMethod[]
    property: IntrospectProperty[]
    signal: IntrospectSignal[]
}