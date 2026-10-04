import {DBusTypeClass} from '../DBusTypeClass'

/**
 * A DBus UNIX_FD ('h'): the index of a file descriptor passed along with the message.
 * Node.js sockets cannot pass file descriptors, so a message containing one is rejected with an error.
 */
export class DBusUnixFD extends DBusTypeClass {

    /**
     * The DBus type code, 'h'.
     */
    public static type: string = 'h'

    /**
     * @param value - The file descriptor index.
     */
    constructor(value: number) {
        super(DBusUnixFD.type, value)
    }
}