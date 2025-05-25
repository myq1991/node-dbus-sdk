import {LocalObject} from '../../LocalObject'
import {ObjectManagerInterface} from './ObjectManagerInterface'

/**
 * A class representing the root object in a DBus object hierarchy.
 * Extends LocalObject to define a root object at the path '/' and automatically
 * adds an ObjectManagerInterface for managing sub-objects and interfaces.
 * This is typically used as the top-level object in a local DBus service.
 */
export class RootObject extends LocalObject {
    /**
     * Constructor for the RootObject class.
     * Initializes the root object with the path '/' and adds an instance of
     * ObjectManagerInterface to support hierarchical object management as per
     * the 'org.freedesktop.DBus.ObjectManager' interface specification.
     */
    constructor() {
        super('/') // Root path for the object hierarchy
        this.addInterface(new ObjectManagerInterface()) // Adds support for object management
    }
}
