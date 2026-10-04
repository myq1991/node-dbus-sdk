/**
 * Options for creating a LocalService.
 */
export interface LocalServiceOpts {
    /**
     * Where the service's org.freedesktop.DBus.ObjectManager is, which announces objects as they are added and
     * removed: '/' by default, a path such as '/org/example/App' to manage only the objects below it (the service
     * creates an object there; add interfaces to it with service.getObject(path)), or null for no object manager.
     * More managers can be added by adding an ObjectManagerInterface to any object; each object is reported by its
     * nearest manager above it.
     */
    objectManagerPath?: string | null
}
