export interface ReplyOpts {
    destination: string
    replySerial: number
    signature?: string
    data?: any[] | Error
}