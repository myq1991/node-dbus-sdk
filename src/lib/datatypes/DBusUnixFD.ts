import {DBusTypeClass} from '../DBusTypeClass'

export class DBusUnixFD extends DBusTypeClass {

    public static type: string = 'h'

    constructor(value: number) {
        super(DBusUnixFD.type, value)
    }
}