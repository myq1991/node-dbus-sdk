/**
 * Create DBus Error
 * @param DBusErrorName
 * @param message
 * @constructor
 */
export function CreateDBusError(DBusErrorName: string, message: string): Error {
    const error: Error = Error(message)
    error.name = DBusErrorName
    return error
}