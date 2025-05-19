import {IntrospectMethodArgument} from './IntrospectMethodArgument'

export interface IntrospectMethod {
    name: string
    arg: IntrospectMethodArgument[]
}