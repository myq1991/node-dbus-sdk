export interface InvokeMethodOpts {
    service: string
    objectPath: string
    interface: string
    method: string
    signature?: string
    args?: any[]
}