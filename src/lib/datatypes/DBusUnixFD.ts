import {DBusTypeClass} from '../DBusTypeClass'

/**
 * @deprecated The native node.js socket supports creating unix domain sockets, but they do not support passing file descriptors.
 */
export class DBusUnixFD extends DBusTypeClass {

    public static type: string = 'h'

    constructor(value: number) {
        super(DBusUnixFD.type, value)
    }
}