// Lets the examples import 'dbus-sdk' from this repository's build instead of node_modules:
//   node --import ./examples/use-local-build.mjs examples/01-bus-basics.ts
// Code copied into a project that installed dbus-sdk does not need it.
import {registerHooks} from 'node:module'

const localBuild = new URL('../build/NodeDBusSDK.js', import.meta.url).href

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === 'dbus-sdk') return {url: localBuild, format: 'commonjs', shortCircuit: true}
        return nextResolve(specifier, context)
    }
})
