export interface emitPropertiesChangedOpts {
    emitValue: boolean
}

export interface DefinePropertyOpts {
    name: string
    type: string
    emitPropertiesChanged?: boolean | emitPropertiesChangedOpts
    getter?: () => Promise<any> | any
    setter?: (value: any) => Promise<void> | void
}