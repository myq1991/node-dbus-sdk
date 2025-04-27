export type IntrospectInterface = {
    $: { name: string }
    method?: IntrospectInterfaceMethod[]
    signal?: IntrospectInterfaceSignal[]
    property?: IntrospectInterfaceProperty[]
}

export type IntrospectInterfaceMethod = {
    $: { name: string }
    arg?: IntrospectInterfaceMethodArg[]
}

export type IntrospectInterfaceMethodArg = {
    $: {
        type: string
        name: string
        direction: string
    }
}

export type IntrospectInterfaceSignal = {
    $: { name: string }
    arg?: IntrospectInterfaceSignalArg[]
}

export type IntrospectInterfaceSignalArg = {
    $: {
        type: string
        name: string
    }
}

export type IntrospectInterfaceProperty = {
    $: {
        type: string
        name: string
        access: string
    }
}