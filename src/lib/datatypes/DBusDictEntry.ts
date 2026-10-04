import {DBusTypeClass} from '../DBusTypeClass'
import {DBusSignedValue} from '../DBusSignedValue'
import {InvalidValueError, SignatureError} from '../Errors'
import {describe} from '../integerRanges'

/**
 * A DBus DICT_ENTRY ('{..}'): one key/value pair, built from typed values; a dictionary is a DBusArray of them. For
 * plain values give the dictionary's signature instead: new DBusSignedValue('a{su}', {count: 7}).
 *
 * @example
 * new DBusArray([new DBusDictEntry([new DBusString('count'), new DBusUInt32(7)])])   // 'a{su}'
 */
export class DBusDictEntry<T extends DBusSignedValue = DBusSignedValue> extends DBusTypeClass {

    /**
     * The DBus type code, '{'.
     */
    public static type: string = '{'

    /**
     * The key, as a typed value.
     */
    public get key(): T {
        return (this.$value as [T, T])[0]
    }

    /**
     * The value of the entry, as a typed value (`value` gives the whole entry as a plain value).
     */
    public get content(): T {
        return (this.$value as [T, T])[1]
    }

    /**
     * @param value - The key, a typed value of a basic type (e.g. DBusString), and the value, any typed value.
     * @throws {InvalidValueError} When the key or the value is a plain value.
     * @throws {SignatureError} When the key is not of a basic type.
     */
    constructor(value: [T, T]) {
        super(DBusDictEntry.type, value)
        const [key, entryValue] = value as unknown[]
        for (const [label, item] of [['key', key], ['value', entryValue]] as [string, unknown][]) {
            if (!(item instanceof DBusSignedValue)) throw new InvalidValueError(`The ${label} of a DBusDictEntry must be a typed value such as new DBusString('name'), got ${describe(item)}; for plain values give the dictionary's signature instead, e.g. new DBusSignedValue('a{su}', {count: 7})`)
        }
        const keySignature: string = (key as DBusSignedValue).signature
        if (keySignature.length !== 1 || 'av({'.includes(keySignature)) throw new SignatureError(`The key of a DBusDictEntry must be of a basic type, got '${keySignature}'`)
    }
}
