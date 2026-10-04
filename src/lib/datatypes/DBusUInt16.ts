import {DBusTypeClass} from '../DBusTypeClass'

export class DBusUInt16 extends DBusTypeClass {

    public static type: string = 'q'

    constructor(value: number) {
        super(DBusUInt16.type, value)
    }
}