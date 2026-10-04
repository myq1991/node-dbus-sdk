import path from 'node:path'
import {writeFileSync} from 'node:fs'
import ts from 'typescript'

const ROOT: string = path.resolve(__dirname, '../../..')
const ENTRY: string = path.join(ROOT, 'src', 'NodeDBusSDK.ts')
export const API_DOC_PATH: string = path.join(ROOT, 'doc', 'API.md')

/**
 * Sections of the reference, in order, with the exports they hold. Exports not listed fall into the last matching
 * catch-all section (type classes, errors, types).
 */
const SECTIONS: { title: string, intro: string, names?: string[], match?: (symbol: ts.Symbol, declaration: ts.Declaration) => boolean }[] = [
    {
        title: 'Client',
        intro: 'Connecting to a bus and using the services on it.',
        names: ['DBus', 'DBusService', 'DBusObject', 'DBusInterface', 'DBusSignalEmitter', 'DBusObjectManager']
    },
    {
        title: 'Service',
        intro: 'Providing a service: its objects, interfaces, methods, properties and signals.',
        names: ['LocalService', 'LocalObject', 'LocalInterface', 'createDBusError', 'PropertiesInterface', 'IntrospectableInterface', 'PeerInterface', 'ObjectManagerInterface']
    },
    {
        title: 'Values and signatures',
        intro: 'Typed values, signatures, and the enums used by the API.',
        names: ['DBusSignedValue', 'Signature', 'RequestNameFlags', 'RequestNameResultCode', 'DBusPropertyAccess', 'DBusMessageType', 'DBusMessageFlags', 'DBusMessageEndianness']
    },
    {
        title: 'Type classes',
        intro: 'One class per DBus type, to give a value an explicit type, e.g. inside a variant.',
        match: (symbol: ts.Symbol, declaration: ts.Declaration): boolean => ts.isClassDeclaration(declaration) && /^DBus(Array|Boolean|Byte|DictEntry|Double|Int\d+|UInt\d+|ObjectPath|Signature|String|Struct|UnixFD|Variant)$/.test(symbol.name)
    },
    {
        title: 'Errors',
        intro: 'Errors thrown by the library. Errors replied by the other side of a call are plain `Error`s whose `name` is the DBus error name.',
        match: (symbol: ts.Symbol, declaration: ts.Declaration): boolean => ts.isClassDeclaration(declaration) && symbol.name.endsWith('Error')
    },
    {
        title: 'Low level',
        intro: 'The connection, messages and the wire format encoder and decoder. Not needed for ordinary use.',
        names: ['DBusConnection', 'DBusMessage', 'DBusBufferEncoder', 'DBusBufferDecoder']
    },
    {
        title: 'Option and data types',
        intro: 'Types of options, callbacks and introspection data.',
        match: (): boolean => true
    }
]

interface Rendered {
    name: string
    markdown: string
}

/**
 * Generates doc/API.md from the package's public declarations and their documentation, so the reference cannot
 * drift from the code.
 */
export function generateApiDoc(): string {
    const program: ts.Program = ts.createProgram([ENTRY], {stripInternal: true, strict: true})
    const checker: ts.TypeChecker = program.getTypeChecker()
    const entry: ts.Symbol = checker.getSymbolAtLocation(program.getSourceFile(ENTRY)!)!
    const print = (type: ts.Type, node?: ts.Node): string => checker.typeToString(type, node, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope)
    const isInternal = (symbol: ts.Symbol): boolean => symbol.getJsDocTags(checker).some((tag: ts.JSDocTagInfo): boolean => tag.name === 'internal')

    function docOf(symbol: ts.Symbol | ts.Signature): string {
        const text: string = ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim()
        const tags: ts.JSDocTagInfo[] = symbol.getJsDocTags(checker)
        const parts: string[] = text ? [text] : []
        const params: string[] = tags.filter((tag: ts.JSDocTagInfo): boolean => tag.name === 'param').map((tag: ts.JSDocTagInfo): string => {
            const [name, ...rest] = ts.displayPartsToString(tag.text).split(/\s+/)
            return `- \`${name}\`: ${rest.join(' ').replace(/^- /, '')}`
        })
        if (params.length) parts.push(params.join('\n'))
        for (const tag of tags) {
            const tagText: string = ts.displayPartsToString(tag.text).trim()
            if (tag.name === 'returns' && tagText) parts.push(`Returns: ${tagText}`)
            if (tag.name === 'throws' && tagText) parts.push(`Throws: ${tagText}`)
            if (tag.name === 'example' && tagText) parts.push('```typescript\n' + tagText + '\n```')
        }
        return parts.join('\n\n')
    }

    function signatureLines(name: string, symbol: ts.Symbol, declaration: ts.Node): string[] {
        const type: ts.Type = checker.getTypeOfSymbolAtLocation(symbol, declaration)
        return type.getCallSignatures().map((signature: ts.Signature): string => `${name}${checker.signatureToString(signature, declaration, ts.TypeFormatFlags.NoTruncation)}`)
    }

    /**
     * Table rows for listener methods overloaded per event name (eventName: 'x', listener: (...) => void), with the
     * first sentence of each overload's documentation.
     */
    function eventTable(symbol: ts.Symbol, declaration: ts.Node): string[] {
        return checker.getTypeOfSymbolAtLocation(symbol, declaration).getCallSignatures().flatMap((signature: ts.Signature): string[] => {
            const [eventParameter, listenerParameter] = signature.getParameters()
            if (!eventParameter || !listenerParameter || eventParameter.name !== 'eventName') return []
            const eventType: ts.Type = checker.getTypeOfSymbol(eventParameter)
            if (!eventType.isStringLiteral()) return []
            const listener: ts.Signature | undefined = checker.getTypeOfSymbol(listenerParameter).getCallSignatures()[0]
            const args: string = listener ? listener.getParameters().map((parameter: ts.Symbol): string => `${parameter.name}: ${print(checker.getTypeOfSymbol(parameter))}`).join(', ') : ''
            const doc: string = ts.displayPartsToString(signature.getDocumentationComment(checker)).trim()
            // "Adds an event listener for the 'x' event, emitted when ..." → "... when ..."
            const when: string = (/emitted (when|for) ([^.]*)/i.exec(doc)?.[0] ?? doc.split('.')[0]).replace(/^emitted /i, '')
            return [`| \`${eventType.value}\` | \`(${args})\` | ${when.replace(/\n/g, ' ').replace(/\|/g, '\\|')} |`]
        })
    }

    function renderMembers(owner: ts.Symbol, declaration: ts.ClassDeclaration | ts.InterfaceDeclaration): string {
        const out: string[] = []
        const seen: Set<string> = new Set()
        const isStatic = (member: ts.Node): boolean => !!(ts.getCombinedModifierFlags(member as ts.Declaration) & ts.ModifierFlags.Static)
        for (const member of declaration.members as ts.NodeArray<ts.ClassElement | ts.TypeElement>) {
            const flags: ts.ModifierFlags = ts.getCombinedModifierFlags(member as ts.Declaration)
            if (flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) continue
            if (member.name && ts.isPrivateIdentifier(member.name)) continue
            if (ts.isIndexSignatureDeclaration(member)) continue
            if (ts.isConstructorDeclaration(member)) {
                // With overloads only the overload signatures are published, and @internal ones are stripped
                const overloaded: boolean = declaration.members.filter(ts.isConstructorDeclaration).length > 1
                if ((overloaded && member.body) || ts.getJSDocTags(member).some((tag: ts.JSDocTag): boolean => tag.tagName.text === 'internal')) continue
                const signature: ts.Signature = checker.getSignatureFromDeclaration(member)!
                out.push(`#### \`new ${owner.name}${checker.signatureToString(signature, member, ts.TypeFormatFlags.NoTruncation)}\`\n\n${docOf(signature)}`.trim())
                continue
            }
            if (!member.name) continue
            const memberSymbol: ts.Symbol | undefined = checker.getSymbolAtLocation(member.name)
            if (!memberSymbol || isInternal(memberSymbol)) continue
            const name: string = member.name.getText()
            const prefix: string = isStatic(member) ? `${owner.name}.` : ''
            const key: string = prefix + name
            if (seen.has(key)) continue
            seen.add(key)
            let heading: string
            if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
                const lines: string[] = signatureLines(prefix + name, memberSymbol, member)
                const events: string[] = eventTable(memberSymbol, member)
                if (events.length) {
                    // Event overloads: on lists the events, the other listener methods refer to it
                    if (name !== 'on') {
                        out.push(`#### \`${prefix}${name}(eventName, listener)\`\n\nThe same events as \`on\`.`)
                        continue
                    }
                    out.push(`#### \`on(eventName, listener)\`\n\nListens to an event of this ${owner.name}:\n\n| Event | Listener arguments | Emitted when |\n|---|---|---|\n${events.join('\n')}`)
                    continue
                }
                heading = lines.length > 1 ? `#### \`${prefix}${name}\`\n\n\`\`\`typescript\n${lines.join('\n')}\n\`\`\`` : `#### \`${lines[0] ?? name + '()'}\``
            } else {
                const type: ts.Type = checker.getTypeOfSymbolAtLocation(memberSymbol, member)
                const optional: string = memberSymbol.flags & ts.SymbolFlags.Optional ? '?' : ''
                const readonly: string = ts.isGetAccessorDeclaration(member) && !memberSymbol.declarations?.some(ts.isSetAccessorDeclaration) || flags & ts.ModifierFlags.Readonly ? 'readonly ' : ''
                heading = `#### \`${readonly}${prefix}${name}${optional}: ${print(type, member)}\``
            }
            // Overloads share one symbol, whose documentation joins theirs: use the last documented overload, the
            // general one
            const signatures: readonly ts.Signature[] = ts.isMethodDeclaration(member) || ts.isMethodSignature(member)
                ? checker.getTypeOfSymbolAtLocation(memberSymbol, member).getCallSignatures()
                : []
            const documented: ts.Signature | undefined = [...signatures].reverse().find((signature: ts.Signature): boolean => !!ts.displayPartsToString(signature.getDocumentationComment(checker)).trim())
            const doc: string = signatures.length > 1 && documented ? docOf(documented) : docOf(memberSymbol)
            out.push(`${heading}\n\n${doc}`.trim())
        }
        return out.join('\n\n')
    }

    function render(symbol: ts.Symbol, declaration: ts.Declaration): string {
        const doc: string = docOf(symbol)
        if (ts.isClassDeclaration(declaration)) {
            const heritage: string = declaration.heritageClauses?.map((clause: ts.HeritageClause): string => clause.getText()).join(' ') || ''
            const members: string = renderMembers(symbol, declaration)
            return [`### class \`${symbol.name}\`${heritage ? ` (${heritage.replace(/\s+/g, ' ')})` : ''}`, doc, members].filter(Boolean).join('\n\n')
        }
        if (ts.isInterfaceDeclaration(declaration)) {
            return [`### interface \`${symbol.name}\``, doc, renderMembers(symbol, declaration)].filter(Boolean).join('\n\n')
        }
        if (ts.isEnumDeclaration(declaration)) {
            const members: string = declaration.members.map((member: ts.EnumMember): string => {
                const memberSymbol: ts.Symbol = checker.getSymbolAtLocation(member.name)!
                const value: string | number | undefined = checker.getConstantValue(member)
                const memberDoc: string = ts.displayPartsToString(memberSymbol.getDocumentationComment(checker)).trim()
                return `| \`${member.name.getText()}\` | \`${JSON.stringify(value)}\` | ${memberDoc.replace(/\n/g, ' ')} |`
            }).join('\n')
            return [`### enum \`${symbol.name}\``, doc, `| Member | Value | Meaning |\n|---|---|---|\n${members}`].filter(Boolean).join('\n\n')
        }
        if (ts.isFunctionDeclaration(declaration)) {
            return [`### \`${signatureLines(symbol.name, symbol, declaration)[0]}\``, doc].filter(Boolean).join('\n\n')
        }
        // Type aliases: their definition as written
        const text: string = ts.isTypeAliasDeclaration(declaration) ? `type ${symbol.name} = ${declaration.type.getText()}` : declaration.getText()
        return [`### type \`${symbol.name}\``, '```typescript\n' + text.replace(/\n\s*\/\*\*[\s\S]*?\*\//g, '') + '\n```', doc].filter(Boolean).join('\n\n')
    }

    /**
     * One row of the errors table: class, code, errno and when it is thrown.
     */
    function errorRow(symbol: ts.Symbol, declaration: ts.ClassDeclaration): string {
        const initializer = (name: string): string => {
            const member: ts.ClassElement | undefined = declaration.members.find((item: ts.ClassElement): boolean => item.name?.getText() === name)
            return member && ts.isPropertyDeclaration(member) && member.initializer ? member.initializer.getText().replace(/'/g, '') : ''
        }
        const doc: string = ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim().replace(/\n/g, ' ').replace(/\|/g, '\\|')
        return `| \`${symbol.name}\` | \`${initializer('code')}\` | ${initializer('errno')} | ${doc} |`
    }

    const sections: Rendered[][] = SECTIONS.map((): Rendered[] => [])
    for (const exported of checker.getExportsOfModule(entry)) {
        const symbol: ts.Symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
        const declaration: ts.Declaration | undefined = symbol.declarations?.[0]
        if (!declaration || isInternal(symbol)) continue
        let index: number = SECTIONS.findIndex((section): boolean => !!section.names?.includes(symbol.name))
        if (index < 0) index = SECTIONS.findIndex((section): boolean => !section.names && !!section.match?.(symbol, declaration))
        sections[index].push({name: symbol.name, markdown: SECTIONS[index].title === 'Errors' ? errorRow(symbol, declaration as ts.ClassDeclaration) : render(symbol, declaration)})
    }

    SECTIONS.forEach((section, index: number): void => {
        // Listed sections keep their order; catch-all sections are alphabetical
        if (!section.names) sections[index].sort((a: Rendered, b: Rendered): number => a.name.localeCompare(b.name))
        else sections[index].sort((a: Rendered, b: Rendered): number => section.names!.indexOf(a.name) - section.names!.indexOf(b.name))
    })
    const out: string[] = [
        '# API reference',
        '',
        '<!-- Generated from the type declarations and their documentation by src/tests/tools/ApiDoc.ts: run `npm run docs:api` after changing the public API. A unit test fails when this file is out of date. -->',
        '',
        'Everything below is exported by `dbus-sdk`. For a guided introduction see the [README](../README.md); for',
        'complete programs see [examples](../examples/README.md).',
        '',
        SECTIONS.map((section, index: number): string => `- [${section.title}](#${section.title.toLowerCase().replace(/ /g, '-')}): ${sections[index].map((item: Rendered): string => `\`${item.name}\``).join(', ')}`).join('\n')
    ]
    SECTIONS.forEach((section, index: number): void => {
        const items: Rendered[] = sections[index]
        const body: string = section.title === 'Errors'
            ? `Every class sets \`name\` to its class name and has a stable \`code\` and \`errno\`.\n\n| Class | code | errno | Thrown when |\n|---|---|---|---|\n${items.map((item: Rendered): string => item.markdown).join('\n')}`
            : items.map((item: Rendered): string => item.markdown).join('\n\n')
        out.push('', `## ${section.title}`, '', section.intro, '', body)
    })
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

if (require.main === module) {
    writeFileSync(API_DOC_PATH, generateApiDoc())
    console.log(`wrote ${path.relative(process.cwd(), API_DOC_PATH)}`)
}
