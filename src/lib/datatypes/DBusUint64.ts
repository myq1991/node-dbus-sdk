import {DBusTypeClass} from '../DBusTypeClass'

export class DBusUint64 extends DBusTypeClass {

    public static type: string = 't'

    constructor(value: bigint) {
        super(DBusUint64.type, value)
    }
}