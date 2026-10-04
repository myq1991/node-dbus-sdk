/**
 * Access mode of a property, as published in introspection data.
 */
export enum DBusPropertyAccess {
    /**
     * The property can be read.
     */
    READ = 'read',
    /**
     * The property can be written.
     */
    WRITE = 'write',
    /**
     * The property can be read and written.
     */
    READWRITE = 'readwrite',
}