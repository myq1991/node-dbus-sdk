import {DBusTypeClass} from '../DBusTypeClass'

export class DBusUint32 extends DBusTypeClass {

    public static type: string = 'u'

    constructor(value: number) {
        super(DBusUint32.type, value)
    }
}