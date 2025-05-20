export class LocalInterface {

    readonly #name: string

    public get name(): string {
        return this.#name
    }

    constructor(interfaceName: string) {
        this.#name = interfaceName
    }


}