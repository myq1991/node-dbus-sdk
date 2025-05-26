import {DBusSignedValue} from './DBusSignedValue'

export class DBusTypeClass extends DBusSignedValue {
    public static type: string

    public $arrayItemSignature: string

    public get value(): any {
        return DBusSignedValue.toJSON([this])[0]
    }
}