import {IntrospectSignalArgument} from './IntrospectSignalArgument'

export interface IntrospectSignal {
    name: string
    arg: IntrospectSignalArgument[]
}