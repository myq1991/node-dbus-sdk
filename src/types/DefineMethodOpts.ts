import {IntrospectMethodArgument} from './IntrospectMethodArgument'

export interface DefineMethodOpts {
    name: string
    inputArgs?: IntrospectMethodArgument[]
    outputArgs?: IntrospectMethodArgument[],
    method: (...args: any[]) => Promise<any | any[]> | any | any[]
}