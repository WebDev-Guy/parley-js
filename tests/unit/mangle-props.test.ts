/**
 * @file mangle-props.test.ts
 * @description Guards the production property-mangling rules
 *
 * The production build renames `_`-prefixed properties (build/mangle-props.ts).
 * That is only safe for names that never cross the bundle boundary. This
 * test walks the source with the TypeScript compiler and fails if any
 * `_` name that IS visible outside the bundle would be mangled:
 *
 * - class members that are not `private` (protected = subclass API)
 * - fields of interfaces / type literals (wire protocol and public types)
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { MANGLE_PROPS, RESERVED_PROPS } from '../../build/mangle-props';

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        return statSync(full).isDirectory()
            ? sourceFiles(full)
            : full.endsWith('.ts')
              ? [full]
              : [];
    });
}

function nameOf(node: ts.ClassElement | ts.TypeElement): string | undefined {
    return node.name && ts.isIdentifier(node.name) ? node.name.text : undefined;
}

function isPrivate(node: ts.Node): boolean {
    return (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Private) !== 0;
}

/** `_` names reachable from outside the bundle */
function externallyVisibleUnderscoreNames(): Map<string, string> {
    const found = new Map<string, string>();

    for (const file of sourceFiles(join(import.meta.dirname, '../../src'))) {
        const source = ts.createSourceFile(
            file,
            readFileSync(file, 'utf8'),
            ts.ScriptTarget.Latest,
            true
        );

        const visit = (node: ts.Node): void => {
            if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
                for (const member of node.members) {
                    const name = nameOf(member);
                    if (name?.startsWith('_') && !isPrivate(member)) {
                        found.set(name, `${file}: non-private class member`);
                    }
                }
            }

            if (ts.isInterfaceDeclaration(node) || ts.isTypeLiteralNode(node)) {
                for (const member of node.members) {
                    const name = nameOf(member);
                    if (name?.startsWith('_')) {
                        found.set(name, `${file}: interface/type field`);
                    }
                }
            }

            ts.forEachChild(node, visit);
        };

        visit(source);
    }

    return found;
}

describe('production property mangling', () => {
    const visible = externallyVisibleUnderscoreNames();

    it('finds the externally visible names (sanity check)', () => {
        expect(visible.has('_requestId')).toBe(true);
        expect(visible.has('_handleMessageEvent')).toBe(true);
    });

    it('reserves every externally visible _ name', () => {
        const unreserved = [...visible]
            .filter(([name]) => MANGLE_PROPS.test(name) && !RESERVED_PROPS.test(name))
            .map(([name, where]) => `${name} (${where})`);

        // If this fails: add the name to build/mangle-props.ts
        expect(unreserved).toEqual([]);
    });

    it('still mangles private members', () => {
        expect(RESERVED_PROPS.test('_pendingRequests')).toBe(false);
        expect(MANGLE_PROPS.test('_pendingRequests')).toBe(true);
    });
});
