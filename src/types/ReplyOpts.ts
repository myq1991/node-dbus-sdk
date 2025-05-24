/**
 * Interface defining options for sending a reply to a DBus method call.
 * Used to specify the details of a response message, including the destination and data.
 */
export interface ReplyOpts {
    /**
     * The destination service or client to which the reply is sent.
     * This identifies the recipient of the reply message (e.g., a unique connection name or well-known service name).
     */
    destination: string

    /**
     * The serial number of the original method call message to which this is a reply.
     * This is used to match the reply with the original request.
     */
    replySerial: number

    /**
     * The optional type signature of the reply data.
     * This is a string describing the types of the data being returned (e.g., 's' for string, 'i' for integer).
     * If not provided, it may be inferred or default to an empty signature.
     */
    signature?: string

    /**
     * The optional data or error to include in the reply.
     * This can be an array of values matching the signature if provided, or an Error object if the reply indicates failure.
     */
    data?: any[] | Error
}
