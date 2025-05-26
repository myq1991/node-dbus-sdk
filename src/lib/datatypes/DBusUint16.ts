import {DBusTypeClass} from '../DBusTypeClass'

export class DBusUint16 extends DBusTypeClass {

    public static type: string = 'q'

    constructor(value: number) {
        super(DBusUint16.type, value)
    }
}