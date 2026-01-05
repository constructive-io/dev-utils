import * as t from '@babel/types';
import generate from '@babel/generator';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { ResolvedCelProtoParserOptions } from '../options';

/**
 * Convert a string to camelCase
 */
export function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Convert a string to PascalCase
 */
export function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get the field name, handling protobuf naming conventions
 */
export function getFieldName(field: { name: string }, fallback: string): string {
  return field.name || fallback;
}

/**
 * Convert Babel AST nodes to TypeScript code string
 */
export function convertAstToCode(
  nodes: t.Statement | t.Statement[]
): string {
  const program = t.program(Array.isArray(nodes) ? nodes : [nodes]);
  const { code } = generate(program, {
    comments: true
  });
  return code;
}

/**
 * Create a named import statement
 */
export function createNamedImport(
  names: string[],
  source: string
): t.ImportDeclaration {
  const specifiers = names.map((name) =>
    t.importSpecifier(t.identifier(name), t.identifier(name))
  );
  return t.importDeclaration(specifiers, t.stringLiteral(source));
}

/**
 * Create a default import statement
 */
export function createDefaultImport(
  name: string,
  source: string
): t.ImportDeclaration {
  return t.importDeclaration(
    [t.importDefaultSpecifier(t.identifier(name))],
    t.stringLiteral(source)
  );
}

/**
 * Write content to a file, creating directories as needed
 */
export function writeFileToDisk(
  filePath: string,
  content: string,
  _options: ResolvedCelProtoParserOptions
): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
}

/**
 * Clone a protobuf node and add a name property
 */
export function cloneAndNameNode<T extends object>(
  node: T,
  name: string
): T & { name: string } {
  return { ...node, name };
}

/**
 * Strip file extension from a path
 */
export function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

/**
 * Ensure a filename has the correct extension
 */
export function ensureExtension(filename: string, ext: string): string {
  if (!ext.startsWith('.')) {
    ext = '.' + ext;
  }
  if (filename.endsWith(ext)) {
    return filename;
  }
  // Remove any existing extension and add the new one
  const base = stripExtension(filename);
  return base + ext;
}
