import {DBusTypeClass} from '../DBusTypeClass'

export class DBusDouble extends DBusTypeClass {

    public static type: string = 'd'

    constructor(value: number) {
        super(DBusDouble.type, value)
    }
}