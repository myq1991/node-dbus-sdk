/**
 * Interface defining operations for interacting with a DBus property.
 * Used to provide methods for getting and setting the value of a property on a DBus object.
 */
export interface PropertyOperation {
    /**
     * Sets the value of the property.
     * This method sends the provided value to the DBus object to update the property.
     *
     * @param value - The value to set for the property.
     * @returns A Promise that resolves when the property value is successfully set.
     */
    set(value: any): Promise<void>

    /**
     * Retrieves the current value of the property.
     * This method queries the DBus object to get the current value of the property.
     *
     * @returns A Promise that resolves with the current value of the property.
     */
    get(): Promise<any>
}
