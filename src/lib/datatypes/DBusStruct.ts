import {DBusTypeClass} from '../DBusTypeClass'
import {DBusSignedValue} from '../DBusSignedValue'
import {InvalidValueError, SignatureError} from '../Errors'
import {describe} from '../integerRanges'

/**
 * A DBus STRUCT ('(...)') built from typed values, one per field. For plain values give the signature instead:
 * new DBusSignedValue('(si)', ['answer', 42]).
 *
 * @example
 * new DBusStruct([new DBusString('answer'), new DBusInt32(42)])   // '(si)'
 */
export class DBusStruct<T extends DBusSignedValue = DBusSignedValue> extends DBusTypeClass {

    /**
     * The DBus type code, '('.
     */
    public static type: string = '('

    /**
     * The fields in order, as typed values (type class instances when decoded with DecodeOpts.types 'variants' or
     * 'all').
     */
    public get fields(): T[] {
        return this.$value as T[]
    }

    /**
     * @param value - The fields in order: typed values (DBusSignedValue or type class instances), at least one.
     * @throws {InvalidValueError} When a field is a plain value.
     * @throws {SignatureError} When there are no fields: DBus has no empty structs.
     */
    constructor(value: T[]) {
        super(DBusStruct.type, value)
        if (!value.length) throw new SignatureError('A DBusStruct needs at least one field: DBus has no empty structs')
        value.forEach((field: unknown, index: number): void => {
            if (!(field instanceof DBusSignedValue)) throw new InvalidValueError(`DBusStruct fields must be typed values such as new DBusInt32(1), got ${describe(field)} for field ${index}; for plain values give the signature instead, e.g. new DBusSignedValue('(si)', ['a', 1])`)
        })
    }
}
