export enum DBusMethodArgumentDirection {
    IN = 'in',
    OUT = 'out'
}

export interface IDBusMethodArgument {
    readonly type: string
    readonly name: string
    readonly direction: DBusMethodArgumentDirection
}