import {DBusTypeClass} from '../DBusTypeClass'

export class DBusUInt64 extends DBusTypeClass {

    public static type: string = 't'

    constructor(value: bigint) {
        super(DBusUInt64.type, value)
    }
}