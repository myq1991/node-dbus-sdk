/*
   http://dbus.freedesktop.org/doc/dbus-specification.html#message-protocol-marshaling

   The following rules define a valid object path.
   Implementations must not send or accept messages with invalid object paths.
   - The path may be of any length.
   - The path must begin with an ASCII '/'
     (integer 47) character, and must consist of elements
     separated by slash characters.
   - Each element must only contain the ASCII characters "[A-Z][a-z][0-9]_"
   - No element may be the empty string.
   - Multiple '/' characters cannot occur in sequence.
   - A trailing '/' character is not allowed unless the path is the root path (a single '/' character).
*/
export function isValidObjectPath(path: string): boolean {
    return /^(\/$)|(\/[A-Za-z0-9_]+)+$/.test(path)
}

export function uniqueArray<T>(arr: T[]): T[] {
    return Array.from(new Set(arr))
}

export function As<T = any>(inp: any): T {
    return inp as T
}