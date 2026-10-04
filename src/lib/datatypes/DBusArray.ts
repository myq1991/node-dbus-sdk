import {DBusTypeClass} from '../DBusTypeClass'
import {DBusVariant} from './DBusVariant'
import {InvalidValueError, SignatureError} from '../Errors'
import {DBusSignedValue} from '../DBusSignedValue'
import {Signature} from '../Signature'
import {DataType} from '../../types/DataType'
import {describe} from '../integerRanges'

/**
 * A DBus ARRAY ('a') built from typed values, all of the same type. For plain values give the signature instead:
 * new DBusSignedValue('au', [1, 2]).
 *
 * @example
 * new DBusArray([new DBusUInt32(1), new DBusUInt32(2)])   // 'au'
 * new DBusArray([], DBusString)                           // an empty 'as'
 * new DBusArray([], 'a{sv}')                              // an empty 'aa{sv}'
 */
export class DBusArray<T extends DBusSignedValue = DBusSignedValue> extends DBusTypeClass {

    /**
     * The DBus type code, 'a'.
     */
    public static type: string = 'a'

    /**
     * The elements, as typed values (type class instances when decoded with DecodeOpts.types 'variants' or 'all').
     */
    public get items(): T[] {
        return this.$value as T[]
    }

    /**
     * @param items - The elements: typed values (DBusSignedValue or type class instances), all of the same type.
     * @param elementType - The element type of an empty array, as a basic type class (e.g. DBusString) or a complete
     *                      signature (e.g. 'a{sv}'); by default variant ('av'). Ignored when there are items.
     * @throws {InvalidValueError} When an item is a plain value.
     * @throws {SignatureError} When the items are of different types, or elementType is not one complete type.
     */
    constructor(items: T[], elementType: string | { type: string } = DBusVariant) {
        super(DBusArray.type, items)
        items.forEach((item: unknown, index: number): void => {
            if (!(item instanceof DBusSignedValue)) throw new InvalidValueError(`DBusArray items must be typed values such as new DBusUInt32(1), got ${describe(item)} at index ${index}; for plain values give the signature instead, e.g. new DBusSignedValue('au', [1, 2])`)
        })
        if (items.length) {
            const signatures: string[] = items.map((item: T): string => item.signature)
            signatures.forEach((signature: string, index: number): void => {
                if (signature !== signatures[0]) throw new SignatureError(`DBusArray items must all be of the same type: item 0 is '${signatures[0]}', item ${index} is '${signature}'`)
            })
            this.$arrayItemSignature = signatures[0][0]
            // Record the complete type, so that an enclosing array or variant does not walk these items again
            DBusSignedValue.setDataType(this, Signature.parse(`a${signatures[0]}`)[0])
            return
        }
        const elementSignature: string = typeof elementType === 'string' ? elementType : elementType.type
        // Parsed as the array's own signature, so that dictionary entries ('{sv}') are accepted where they belong
        let arrayTypes: DataType[]
        try {
            arrayTypes = Signature.parse(`a${elementSignature}`)
        } catch {
            arrayTypes = []
        }
        if (arrayTypes.length !== 1 || !Signature.isComplete(arrayTypes[0])) throw new SignatureError(`The element type of an empty DBusArray must be one complete type, e.g. DBusString or 'a{sv}', got '${elementSignature}'`)
        this.$arrayItemSignature = elementSignature[0]
        // An empty array cannot tell its element type from its items: record it
        DBusSignedValue.setDataType(this, arrayTypes[0])
    }
}
