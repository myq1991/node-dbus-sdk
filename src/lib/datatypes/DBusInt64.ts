import {DBusTypeClass} from '../DBusTypeClass'

export class DBusInt64 extends DBusTypeClass {

    public static type: string = 'x'

    constructor(value: bigint) {
        super(DBusInt64.type, value)
    }
}