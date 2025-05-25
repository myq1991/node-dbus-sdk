/**
 * Interface defining options for emitting property change signals in DBus.
 * Used to configure how property changes are signaled to other applications on the bus.
 */
export interface emitPropertiesChangedOpts {
    /**
     * A boolean flag indicating whether to include the new value of the property in the change signal.
     * If true, the updated value is emitted with the 'PropertiesChanged' signal.
     */
    emitValue: boolean
}

/**
 * Interface defining options for a DBus property.
 * Used to specify the metadata and behavior of a property exposed on a DBus interface.
 */
export interface DefinePropertyOpts {
    /**
     * The name of the property.
     * This is the identifier used to access the property via DBus (e.g., 'Volume').
     */
    name: string

    /**
     * The DBus type signature of the property.
     * This is a string representing the data type of the property (e.g., 's' for string, 'i' for integer).
     */
    type: string

    /**
     * Configuration for emitting the 'PropertiesChanged' signal when the property value changes.
     * Can be a boolean (true to emit the signal, false to disable) or an object of type emitPropertiesChangedOpts
     * to specify additional options like whether to include the new value in the signal.
     */
    emitPropertiesChanged?: boolean | emitPropertiesChangedOpts

    /**
     * An optional getter function for retrieving the property value.
     * This function can return the value synchronously or as a Promise.
     * If not provided, the property is considered write-only or may have a default behavior.
     */
    getter?: () => any

    /**
     * An optional setter function for updating the property value.
     * This function takes the new value as an argument and can return void synchronously or as a Promise.
     * If not provided, the property is considered read-only or may have a default behavior.
     */
    setter?: (value: any) => void
}
