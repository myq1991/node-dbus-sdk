export class DBusTypedValue {
    public _signature: string
    public value: string

    constructor(type: string, value: any) {
        this._signature = type
        this.value = value
    }
}