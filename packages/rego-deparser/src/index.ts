/**
 * Rego Deparser - Convert Rego AST to Rego source code
 *
 * This package provides TypeScript types for OPA's Rego AST and a deparser
 * that converts AST back to valid Rego source code.
 *
 * @example
 * ```typescript
 * import { deparse, Module } from 'rego-deparser';
 *
 * const module: Module = {
 *   package: { path: [{ type: 'var', value: 'example' }] },
 *   rules: [{
 *     head: { name: 'allow', value: { type: 'boolean', value: true } },
 *     body: []
 *   }]
 * };
 *
 * const rego = deparse(module);
 * // Output: "package example\n\nallow = true"
 * ```
 */

export {
  deparse,
  deparseBody,
  deparseElse,
  deparseEvery,
  deparseExpr,
  deparseHead,
  deparseImport,
  deparseModule,
  deparsePackage,
  DeparserOptions,
  deparseRule,
  deparseTerm,
  deparseTerms,
  deparseWith} from './deparser';
export {
  Annotations,
  ArrayComprehension,
  ArrayValue,
  Author,
  Body,
  Call,
  Comment,
  Else,
  Every,
  Expr,
  Head,
  Import,
  InfixOperators,
  Location,
  Module,
  ObjectComprehension,
  ObjectItem,
  ObjectValue,
  Operators,
  Package,
  Precedence,
  Ref,
  RelatedResource,
  Rule,
  SchemaAnnotation,
  SetComprehension,
  SetValue,
  Term,
  TermType,
  TermTypeValue,
  TermValue,
  Var,
  With} from './types';
