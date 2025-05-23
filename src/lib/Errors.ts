export class TimeoutError extends Error implements NodeJS.ErrnoException {
    errno: number = 1000
    code: string = 'E_TIMEOUT'
}

export class UnknownBusAddressError extends Error implements NodeJS.ErrnoException {
    errno: number = 1001
    code: string = 'E_UNKNOWN_BUS_ADDR'
}

export class UnknownBusTypeError extends Error implements NodeJS.ErrnoException {
    errno: number = 1002
    code: string = 'E_UNKNOWN_BUS_TYPE'
}

export class NotEnoughParamsError extends Error implements NodeJS.ErrnoException {
    errno: number = 1003
    code: string = 'E_NOT_ENOUGH_PARAMS'
}

export class CreateStreamFailedError extends Error implements NodeJS.ErrnoException {
    errno: number = 1004
    code: string = 'E_CREATE_STREAM'
}

export class UserPermissionError extends Error implements NodeJS.ErrnoException {
    errno: number = 1005
    code: string = 'E_PERM'
}

export class AuthError extends Error implements NodeJS.ErrnoException {
    errno: number = 1006
    code: string = 'E_AUTH'
}

export class SignatureError extends Error implements NodeJS.ErrnoException {
    errno: number = 1007
    code: string = 'E_SIGNATURE'
}

export class SerialError extends Error implements NodeJS.ErrnoException {
    errno: number = 1008
    code: string = 'E_SERIAL'
}

export class ObjectPathError extends Error implements NodeJS.ErrnoException {
    errno: number = 1009
    code: string = 'E_OBJECT_PATH'
}

export class AlignmentError extends Error implements NodeJS.ErrnoException {
    errno: number = 1010
    code: string = 'E_ALIGNMENT'
}

export class ReadBufferError extends Error implements NodeJS.ErrnoException {
    errno: number = 1011
    code: string = 'E_READ_BUFFER'
}

export class InvalidValueError extends Error implements NodeJS.ErrnoException {
    errno: number = 1012
    code: string = 'E_INVALID_VALUE'
}

export class ServiceNotFoundError extends Error implements NodeJS.ErrnoException {
    errno: number = 1013
    code: string = 'E_SERVICE_NOT_FOUND'
}

export class ObjectNotFoundError extends Error implements NodeJS.ErrnoException {
    errno: number = 1014
    code: string = 'E_OBJECT_NOT_FOUND'
}

export class InterfaceNotFoundError extends Error implements NodeJS.ErrnoException {
    errno: number = 1015
    code: string = 'E_INTERFACE_NOT_FOUND'
}

export class AccessPropertyForbiddenError extends Error implements NodeJS.ErrnoException {
    errno: number = 1016
    code: string = 'E_ACCESS_PROPERTY_FORBIDDEN'
}

export class LocalObjectPathExistsError extends Error implements NodeJS.ErrnoException {
    errno: number = 1017
    code: string = 'E_LOCAL_OBJECT_EXISTS'
}

export class LocalInterfaceExistsError extends Error implements NodeJS.ErrnoException {
    errno: number = 1018
    code: string = 'E_LOCAL_INTERFACE_EXISTS'
}

export class LocalInterfaceMethodDefinedError extends Error implements NodeJS.ErrnoException {
    errno: number = 1019
    code: string = 'E_LOCAL_INTERFACE_METHOD_DEFINED'
}

export class LocalInterfacePropertyDefinedError extends Error implements NodeJS.ErrnoException {
    errno: number = 1020
    code: string = 'E_LOCAL_INTERFACE_PROPERTY_DEFINED'
}

export class LocalInterfaceSignalDefinedError extends Error implements NodeJS.ErrnoException {
    errno: number = 1021
    code: string = 'E_LOCAL_INTERFACE_SIGNAL_DEFINED'
}

export class LocalServiceInvalidNameError extends Error implements NodeJS.ErrnoException {
    errno: number = 1022
    code: string = 'E_INVALID_LOCAL_SERVICE_NAME'
}

export class LocalObjectInvalidNameError extends Error implements NodeJS.ErrnoException {
    errno: number = 1023
    code: string = 'E_INVALID_LOCAL_OBJECT_NAME'
}

export class LocalInterfaceInvalidNameError extends Error implements NodeJS.ErrnoException {
    errno: number = 1024
    code: string = 'E_INVALID_LOCAL_INTERFACE_NAME'
}

