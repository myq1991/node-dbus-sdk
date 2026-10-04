import {DBusTypeClass} from '../DBusTypeClass'

export class DBusUInt32 extends DBusTypeClass {

    public static type: string = 'u'

    constructor(value: number) {
        super(DBusUInt32.type, value)
    }
}