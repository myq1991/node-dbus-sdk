import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
import {API_DOC_PATH, generateApiDoc} from '../tools/ApiDoc'

const ROOT: string = path.resolve(__dirname, '../../..')
const ENTRY: string = path.join(ROOT, 'src', 'NodeDBusSDK.ts')

/**
 * Lists every public declaration reachable from the package entry that has no documentation: exported symbols, their
 * public members, and parameters of public functions and methods without an @param tag. Members marked @internal are
 * stripped from the published declarations and are not checked.
 */
function undocumented(): string[] {
    const program: ts.Program = ts.createProgram([ENTRY], {stripInternal: true, strict: true})
    const checker: ts.TypeChecker = program.getTypeChecker()
    const entry: ts.Symbol = checker.getSymbolAtLocation(program.getSourceFile(ENTRY)!)!
    const missing: string[] = []
    const hasTag = (symbol: ts.Symbol, name: string): boolean => symbol.getJsDocTags(checker).some((tag: ts.JSDocTagInfo): boolean => tag.name === name)
    const hasJSDoc = (node: ts.Node): boolean => ts.getJSDocCommentsAndTags(node).length > 0

    function checkParameters(label: string, symbol: ts.Symbol, declaration: ts.Node): void {
        if (!ts.isMethodDeclaration(declaration) && !ts.isFunctionDeclaration(declaration) && !ts.isConstructorDeclaration(declaration)) return
        const documented: string[] = symbol.getJsDocTags(checker)
            .filter((tag: ts.JSDocTagInfo): boolean => tag.name === 'param')
            .map((tag: ts.JSDocTagInfo): string => ts.displayPartsToString(tag.text).split(/\s/)[0])
        for (const parameter of declaration.parameters) {
            const name: string = parameter.name.getText()
            if (!documented.includes(name)) missing.push(`${label} @param ${name}`)
        }
    }

    for (const exported of checker.getExportsOfModule(entry)) {
        const symbol: ts.Symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
        const declaration: ts.Declaration | undefined = symbol.declarations?.[0]
        if (!declaration || hasTag(symbol, 'internal')) continue
        if (!ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim()) missing.push(symbol.name)
        checkParameters(symbol.name, symbol, declaration)
        if (!ts.isClassDeclaration(declaration) && !ts.isInterfaceDeclaration(declaration) && !ts.isEnumDeclaration(declaration)) continue
        for (const member of declaration.members as ts.NodeArray<ts.ClassElement | ts.TypeElement | ts.EnumMember>) {
            if (ts.getCombinedModifierFlags(member as ts.Declaration) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) continue
            if (member.name && ts.isPrivateIdentifier(member.name)) continue
            if (ts.isIndexSignatureDeclaration(member) || ts.isClassStaticBlockDeclaration(member as ts.Node)) continue
            if (ts.isConstructorDeclaration(member)) {
                if (hasJSDoc(member)) {
                    const params: string[] = ts.getJSDocTags(member).filter(ts.isJSDocParameterTag).map((tag: ts.JSDocParameterTag): string => tag.name.getText())
                    for (const parameter of member.parameters) if (!params.includes(parameter.name.getText())) missing.push(`${symbol.name}.constructor @param ${parameter.name.getText()}`)
                } else {
                    missing.push(`${symbol.name}.constructor`)
                }
                continue
            }
            if (!member.name) continue
            const memberSymbol: ts.Symbol | undefined = checker.getSymbolAtLocation(member.name)
            if (!memberSymbol || hasTag(memberSymbol, 'internal')) continue
            const label: string = `${symbol.name}.${member.name.getText()}`
            if (!ts.displayPartsToString(memberSymbol.getDocumentationComment(checker)).trim()) {
                // Overloads and get/set pairs share one symbol; it is enough that one declaration is documented
                if (!memberSymbol.declarations?.some(hasJSDoc)) missing.push(label)
            }
            checkParameters(label, memberSymbol, member)
        }
    }
    return [...new Set(missing)]
}

describe('documentation', (): void => {
    it('covers every public symbol, member and parameter', (): void => {
        assert.deepEqual(undocumented(), [], 'add JSDoc to these (or mark them @internal if they are not public API)')
    })

    it('is published in an up-to-date doc/API.md', (): void => {
        assert.ok(readFileSync(API_DOC_PATH, 'utf8') === generateApiDoc(), 'doc/API.md is out of date: run npm run docs:api')
    })
})
