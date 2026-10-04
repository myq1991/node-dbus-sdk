import {DecodeOpts} from '../types/DecodeOpts'

/**
 * @internal
 * DecodeOpts with every choice made.
 */
export type ResolvedDecodeOpts = Required<DecodeOpts>

/**
 * @internal
 * The defaults: plain values, dictionaries as objects, 64-bit integers as bigint.
 */
export const DEFAULT_DECODE: ResolvedDecodeOpts = Object.freeze({types: 'none', dictionaries: 'object', int64: 'bigint'})

/**
 * @internal
 * Fills the choices not made in `opts` from `defaults`.
 */
export function resolveDecode(opts: DecodeOpts | undefined, defaults: ResolvedDecodeOpts = DEFAULT_DECODE): ResolvedDecodeOpts {
    if (!opts) return defaults
    return {
        types: opts.types ?? defaults.types,
        dictionaries: opts.dictionaries ?? defaults.dictionaries,
        int64: opts.int64 ?? defaults.int64
    }
}
