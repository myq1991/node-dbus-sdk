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