import {DBusTypeClass} from '../DBusTypeClass'

export class DBusByte extends DBusTypeClass {

    public static type: string = 'y'

    constructor(value: number) {
        super(DBusByte.type, value)
    }
}