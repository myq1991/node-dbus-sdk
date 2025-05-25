/**
 * Interface defining options for emitting property change signals in DBus.
 * Used to configure how property changes are signaled to other applications on the bus
 * when a property value is updated, allowing control over the content of the emitted signal.
 */
export interface emitPropertiesChangedOpts {
    /**
     * A boolean flag indicating whether to include the new value of the property in the change signal.
     * If true, the updated value is included in the 'PropertiesChanged' signal sent over DBus;
     * if false, the signal indicates a change without providing the new value (invalidated only).
     */
    emitValue: boolean
}

/**
 * Interface defining options for a DBus property.
 * Used to specify the metadata and behavior of a property exposed on a DBus interface,
 * enabling the definition of property characteristics, access methods, and change notifications.
 */
export interface DefinePropertyOpts {
    /**
     * The name of the property.
     * This is the identifier used to access the property via DBus (e.g., 'Volume', 'IsPlaying'),
     * and must conform to DBus naming conventions for properties.
     */
    name: string

    /**
     * The DBus type signature of the property.
     * This is a string representing the data type of the property as per DBus type system
     * (e.g., 's' for string, 'i' for integer, 'b' for boolean, 'as' for array of strings).
     */
    type: string

    /**
     * Configuration for emitting the 'PropertiesChanged' signal when the property value changes.
     * Can be a boolean (true to emit the signal with default behavior, false to disable emission)
     * or an object of type emitPropertiesChangedOpts to specify detailed options such as whether
     * to include the new value in the signal.
     */
    emitPropertiesChanged?: boolean | emitPropertiesChangedOpts

    /**
     * An optional getter function for retrieving the property value.
     * This function is called when the property is accessed via DBus (e.g., through the 'Get' method)
     * and can return the value synchronously. If not provided, the property is considered write-only
     * and attempts to read it may result in an error or default behavior depending on implementation.
     */
    getter?: () => any

    /**
     * An optional setter function for updating the property value.
     * This function takes the new value as an argument and is called when the property is modified
     * via DBus (e.g., through the 'Set' method), returning void synchronously. If not provided,
     * the property is considered read-only and attempts to write to it may result in an error.
     */
    setter?: (value: any) => void
}
