/**
 * Type representing DBus data type signatures.
 * These are single-character codes or symbols used to define the structure of DBus messages.
 * Each character corresponds to a specific data type or structural element as per the DBus specification.
 * - '(' : Start of a struct.
 * - '{' : Start of a dictionary entry.
 * - 'y' : Byte (8-bit unsigned integer).
 * - 'b' : Boolean.
 * - 'n' : 16-bit signed integer.
 * - 'q' : 16-bit unsigned integer.
 * - 'i' : 32-bit signed integer.
 * - 'u' : 32-bit unsigned integer.
 * - 'x' : 64-bit signed integer.
 * - 't' : 64-bit unsigned integer.
 * - 'd' : Double (64-bit floating-point).
 * - 's' : String.
 * - 'o' : Object path.
 * - 'g' : Signature (a string representing a type signature).
 * - 'a' : Array (followed by the element type).
 * - 'r' : Struct (used in some contexts to denote a structure).
 * - 'v' : Variant (a container for a value of any type).
 * - 'e' : Dictionary entry (used within a dictionary).
 * - 'h' : Unix file descriptor.
 * - 'm' : Maybe/optional type (used in some contexts).
 * - '*' : Wildcard for any type (used in matching or generic contexts).
 * - '?' : Placeholder for an unknown type.
 * - '@' : Reference to a type (used in some contexts).
 * - '&' : Pointer or reference type (used in some contexts).
 * - '^' : Escaped or special type (used in some contexts).
 */
export type Types =
    '('
    | '{'
    | 'y'
    | 'b'
    | 'n'
    | 'q'
    | 'i'
    | 'u'
    | 'x'
    | 't'
    | 'd'
    | 's'
    | 'o'
    | 'g'
    | 'a'
    | 'r'
    | 'v'
    | 'e'
    | 'h'
    | 'm'
    | '*'
    | '?'
    | '@'
    | '&'
    | '^'

/**
 * Interface representing a DBus data type with its structure.
 * Used to define the type signature of data in DBus messages, including nested types.
 */
export interface DataType {
    /**
     * The type code representing a specific DBus data type or structural element.
     * This corresponds to one of the characters defined in the Types union.
     */
    type: Types

    /**
     * An optional array of child data types.
     * Used for composite types like arrays, structs, or dictionaries to define their nested structure.
     * For example, a struct might have child types for each of its fields.
     */
    child?: DataType[]
}
