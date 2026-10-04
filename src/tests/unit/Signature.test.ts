import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {Signature} from '../../lib/Signature'
import {SignatureError} from '../../lib/Errors'

describe('Signature', (): void => {

    describe('parseSignature', (): void => {
        it('parses a sequence of basic types', (): void => {
            assert.deepEqual(Signature.parseSignature('su').map((type): string => type.type), ['s', 'u'])
        })

        it('parses nested containers', (): void => {
            assert.deepEqual(Signature.parseSignature('a{sa(iv)}'), [{
                type: 'a',
                child: [{
                    type: '{',
                    child: [
                        {type: 's', child: []},
                        {
                            type: 'a',
                            child: [{
                                type: '(',
                                child: [{type: 'i', child: []}, {type: 'v', child: []}]
                            }]
                        }
                    ]
                }]
            }])
        })

        it('returns no types for an empty signature', (): void => {
            assert.deepEqual(Signature.parseSignature(''), [])
        })

        for (const bad of ['z', '(i', 'a', 'a{s']) {
            it(`rejects '${bad}'`, (): void => {
                assert.throws((): any => Signature.parseSignature(bad), SignatureError)
            })
        }
    })

    describe('areSignaturesCompatible', (): void => {
        it('accepts identical signatures', (): void => {
            assert.equal(Signature.areSignaturesCompatible('sa{sv}', 'sa{sv}'), true)
        })

        it('treats a variant in the base signature as accepting any type', (): void => {
            assert.equal(Signature.areSignaturesCompatible('vs', 'a{sv}s'), true)
            assert.equal(Signature.areSignaturesCompatible('a{sv}', 'a{si}'), true)
        })

        it('rejects different types', (): void => {
            assert.equal(Signature.areSignaturesCompatible('s', 'u'), false)
            assert.equal(Signature.areSignaturesCompatible('a{sv}', 'a{iv}'), false)
        })

        it('rejects a different number of arguments', (): void => {
            assert.equal(Signature.areSignaturesCompatible('su', 's'), false)
        })

        it('treats missing signatures as empty', (): void => {
            assert.equal(Signature.areSignaturesCompatible(undefined, ''), true)
            assert.equal(Signature.areSignaturesCompatible(undefined, 's'), false)
        })
    })
})
