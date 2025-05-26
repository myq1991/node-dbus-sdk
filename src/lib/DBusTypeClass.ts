import {DBusSignedValue} from './DBusSignedValue'

export class DBusTypeClass extends DBusSignedValue {
    public static type: string

    public $arrayItemSignature: string

    public $value: any | DBusTypeClass | DBusTypeClass[]

    public get value(): any {
        return DBusSignedValue.toJSON([this])[0]
    }
}