import {LocalInterface} from './LocalInterface'

export class LocalObject {

    readonly #name: string

    public get name(): string {
        return this.#name
    }

    constructor(objectPath: string) {
        this.#name = objectPath
    }

    public addInterface(localInterface: LocalInterface) {
        //TODO
    }
}