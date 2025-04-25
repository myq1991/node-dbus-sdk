type PropertyType = IObject |
    string |
    number |
    boolean |
    bigint |
    symbol |
    any |
    Function

export interface IObject {
    [prop: string]: PropertyType | PropertyType[]
}