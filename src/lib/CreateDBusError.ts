/**
 * Creates a DBus-specific Error object with a custom error name and message.
 * This function is used to generate errors related to DBus operations with identifiable error names.
 *
 * @param DBusErrorName - The name of the DBus error (e.g., 'org.freedesktop.DBus.Error.Failed').
 *                       This identifies the specific type of DBus error.
 * @param message - A descriptive message explaining the cause of the error.
 * @returns An Error object with the specified name and message, representing a DBus error.
 */
export function CreateDBusError(DBusErrorName: string, message: string): Error {
    const error: Error = Error(message)
    error.name = DBusErrorName
    return error
}
