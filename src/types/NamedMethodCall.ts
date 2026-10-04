/**
 * A method of DBusInterface.namedMethod: takes the input arguments as one object keyed by the introspected argument
 * names, and resolves like DBusInterface.method: undefined, the single return value, or an array of them.
 *
 * @throws {NotEnoughParamsError} When an input argument is missing from the object.
 */
export type NamedMethodCall = (parameterObject?: Record<string, any>) => Promise<any>