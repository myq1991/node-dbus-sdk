import {DBusTypeClass} from '../DBusTypeClass'
import {DBusVariant} from './DBusVariant'
import {SignatureError} from '../Errors'

export class DBusArray<T extends DBusTypeClass = DBusTypeClass> extends DBusTypeClass {

    public static type: string = 'a'

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