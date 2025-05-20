export interface DefineMethodArgumentOpts {
    name: string
    type: string
}

export interface DefineMethodOpts {
    name: string
    inputArgs?: DefineMethodArgumentOpts[]
    outputArgs?: DefineMethodArgumentOpts[],
    method: (...args: any[]) => Promise<any | any[]> | any | any[]
}