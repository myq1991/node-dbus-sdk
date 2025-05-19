export interface PropertyOperation {
    set(value: any): Promise<void>

    get(): Promise<any>
}