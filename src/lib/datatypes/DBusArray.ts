import {DBusTypeClass} from '../DBusTypeClass'
import {DBusVariant} from './DBusVariant'
import {SignatureError} from '../Errors'

/**
 * A DBus ARRAY ('a') of type class instances, all of the same type.
 *
 * @example
 * new DBusArray([new DBusUInt32(1), new DBusUInt32(2)])   // 'au'
 * new DBusArray([], DBusString)                           // an empty 'as'
 */
export class DBusArray<T extends DBusTypeClass = DBusTypeClass> extends DBusTypeClass {

    /**
     * The DBus type code, 'a'.
     */
    public static type: string = 'a'

    /**
     * @param items - The elements, all instances of the same type class.
     * @param typeClass - The element type of an empty array (by default variant, 'av'); ignored when there are items.
     * @throws {SignatureError} When the items are of different types.
     */
    constructor(items: T[], typeClass: typeof DBusTypeClass = DBusVariant<any>) {
        super(DBusArray.type, items)
        if (items.length) {
            const arraySignature: string = items[0].$signature
            this.$arrayItemSignature = arraySignature
            for (const item of items) {
                if (item.$signature !== arraySignature) throw new SignatureError(`The array element type should be consistent with the first element type of the array. The first element type is '${arraySignature}', and there is an element type '${item.$signature}' in the array`)
            }
        } else {
            this.$arrayItemSignature = typeClass.type
        }
    }
}