import {DBusTypeClass} from '../DBusTypeClass'

export class DBusInt32 extends DBusTypeClass {

    public static type: string = 'i'

    constructor(value: number) {
        super(DBusInt32.type, value)
    }
}