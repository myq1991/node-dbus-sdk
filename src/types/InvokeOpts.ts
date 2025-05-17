export interface InvokeOpts {
    service: string
    objectPath: string
    interface: string
    method: string
    signature?: string
    args?: any[]
}