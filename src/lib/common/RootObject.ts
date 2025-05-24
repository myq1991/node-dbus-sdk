import {LocalObject} from '../../LocalObject'
import {ObjectManagerInterface} from './ObjectManagerInterface'

export class RootObject extends LocalObject {
    constructor() {
        super('/')
        this.addInterface(new ObjectManagerInterface())
    }
}