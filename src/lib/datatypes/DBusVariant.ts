import {DBusTypeClass} from '../DBusTypeClass'
import {DBusSignedValue} from '../DBusSignedValue'

/**
 * A DBus VARIANT ('v'): a value that carries its own type. A typed value placed where a variant is expected already
 * becomes the variant's content, so this class is needed only to put a variant inside a variant, or to state it.
 *
 * @example
 * new DBusVariant(new DBusUInt32(7))   // a variant holding a 'u'
 * new DBusVariant('text')              // a variant holding an 's', inferred
 */
export class DBusVariant<T = any> extends DBusTypeClass {

    /**
     * The DBus type code, 'v'.
     */
    public static type: string = 'v'

    /**
     * The content, as a typed value whose `signature` is the variant's inner type (a type class instance when decoded
     * with DecodeOpts.types 'variants' or 'all').
     */
    public get content(): DBusSignedValue {
        return this.$value as DBusSignedValue
    }

    /**
     * @param value - The content: a typed value, or a plain value whose type is inferred (see
     *                DBusSignedValue.inferSignature).
     * @throws {InvalidValueError} When the type of a plain value cannot be inferred (null, undefined, …).
     */
    constructor(value: T) {
        super(DBusVariant.type, value)
    }
}
