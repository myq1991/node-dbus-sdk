import {DBusTypeClass} from '../DBusTypeClass'

export class DBusInt16 extends DBusTypeClass {

    public static type: string = 'n'

    constructor(value: number) {
        super(DBusInt16.type, value)
    }
}