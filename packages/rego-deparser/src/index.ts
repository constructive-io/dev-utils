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
  deparseModule,
  deparsePackage,
  deparseImport,
  deparseRule,
  deparseHead,
  deparseBody,
  deparseElse,
  deparseExpr,
  deparseWith,
  deparseTerms,
  deparseTerm,
  deparseEvery,
  DeparserOptions
} from './deparser';

export {
  Module,
  Package,
  Import,
  Rule,
  Head,
  Body,
  Expr,
  Term,
  With,
  Else,
  TermValue,
  Ref,
  Var,
  Call,
  ArrayValue,
  SetValue,
  ObjectValue,
  ObjectItem,
  ArrayComprehension,
  SetComprehension,
  ObjectComprehension,
  Every,
  Location,
  Annotations,
  Author,
  RelatedResource,
  SchemaAnnotation,
  Comment,
  TermType,
  TermTypeValue,
  Operators,
  InfixOperators,
  Precedence
} from './types';
