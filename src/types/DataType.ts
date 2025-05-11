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

export interface DataType {
    type: Types
    child?: DataType[]
}