export interface HandshakeOpts {
    authMethods?: string[]
    uid?: number
    // Set false to enable more verbose objects
    simple?: boolean
    direct?: boolean
}