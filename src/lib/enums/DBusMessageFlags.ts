/**
 * Flags of a message, the third byte of its header; they combine with |.
 */
export enum DBusMessageFlags {
    /**
     * No flag: the sender of a method call expects a reply.
     */
    REPLY_EXPECTED = 0x00,
    /**
     * The sender does not want a reply to this method call.
     */
    NO_REPLY_EXPECTED = 0x01,
    /**
     * The bus must not start (activate) the destination service to deliver this message.
     */
    NO_AUTO_START = 0x02,
    /**
     * The caller is prepared to wait for interactive authorization, e.g. a polkit password prompt.
     */
    ALLOW_INTERACTIVE_AUTH = 0x04
}