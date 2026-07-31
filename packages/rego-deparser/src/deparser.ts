/**
 * Rego Deparser - Converts Rego AST back to Rego source code
 *
 * This module provides functionality to convert a Rego Abstract Syntax Tree (AST)
 * back into valid Rego source code. It handles all major Rego constructs including:
 * - Modules (package, imports, rules)
 * - Rules (complete, partial, functions)
 * - Expressions (terms, operators, comprehensions)
 * - Literals (strings, numbers, arrays, objects, sets)
 */

import {
  ArrayComprehension,
  Body,
  Else,
  Every,
  Expr,
  Head,
  Import,
  InfixOperators,
  Module,
  ObjectComprehension,
  ObjectItem,
  Package,
  Rule,
  SetComprehension,
  Term,
  TermType,
  With} from './types';

export interface DeparserOptions {
  indent?: string;
  newline?: string;
  spaces?: boolean;
}

const DEFAULT_OPTIONS: Required<DeparserOptions> = {
  indent: '\t',
  newline: '\n',
  spaces: true
};

export function deparse(node: Module, options: DeparserOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  return deparseModule(node, opts);
}

export function deparseModule(
  module: Module,
  opts: Required<DeparserOptions>
): string {
  const parts: string[] = [];

  if (module.package) {
    parts.push(deparsePackage(module.package, opts));
  }

  if (module.imports && module.imports.length > 0) {
    if (parts.length > 0) parts.push('');
    for (const imp of module.imports) {
      parts.push(deparseImport(imp, opts));
    }
  }

  if (module.rules && module.rules.length > 0) {
    if (parts.length > 0) parts.push('');
    for (const rule of module.rules) {
      parts.push(deparseRule(rule, opts));
    }
  }

  return parts.join(opts.newline);
}

export function deparsePackage(
  pkg: Package,
  opts: Required<DeparserOptions>
): string {
  if (!pkg.path || pkg.path.length === 0) {
    return 'package main';
  }
  const path = pkg.path.map((t) => deparseTermValue(t, opts)).join('.');
  return `package ${path}`;
}

export function deparseImport(
  imp: Import,
  opts: Required<DeparserOptions>
): string {
  if (!imp.path) {
    return 'import data';
  }
  const path = deparseTerm(imp.path, opts);
  if (imp.alias) {
    return `import ${path} as ${imp.alias}`;
  }
  return `import ${path}`;
}

export function deparseRule(
  rule: Rule,
  opts: Required<DeparserOptions>
): string {
  const parts: string[] = [];

  if (rule.default) {
    const head = deparseHead(rule.head, opts, true);
    parts.push(`default ${head}`);
  } else {
    const head = deparseHead(rule.head, opts, false);
    parts.push(head);

    if (rule.body && rule.body.length > 0) {
      const bodyStr = deparseBody(rule.body, opts);
      if (bodyStr) {
        parts.push(` if {${opts.newline}${bodyStr}${opts.newline}}`);
      }
    }

    if (rule.else) {
      parts.push(deparseElse(rule.else, opts));
    }
  }

  return parts.join('');
}

export function deparseHead(
  head: Head | undefined,
  opts: Required<DeparserOptions>,
  isDefault: boolean
): string {
  if (!head) return '';

  const parts: string[] = [];

  if (head.ref && head.ref.length > 0) {
    parts.push(head.ref.map((t) => deparseTermValue(t, opts)).join('.'));
  } else if (head.name) {
    parts.push(head.name);
  }

  if (head.key) {
    parts.push(`[${deparseTerm(head.key, opts)}]`);
  }

  if (head.value) {
    const op = head.assign ? ':=' : '=';
    parts.push(` ${op} ${deparseTerm(head.value, opts)}`);
  }

  return parts.join('');
}

export function deparseBody(
  body: Body,
  opts: Required<DeparserOptions>,
  indentLevel: number = 1
): string {
  const indent = opts.indent.repeat(indentLevel);
  const exprs = body.map((expr) => `${indent}${deparseExpr(expr, opts)}`);
  return exprs.join(opts.newline);
}

export function deparseElse(
  elseClause: Else,
  opts: Required<DeparserOptions>
): string {
  const parts: string[] = [' else'];

  if (elseClause.value) {
    parts.push(` = ${deparseTerm(elseClause.value, opts)}`);
  }

  if (elseClause.body && elseClause.body.length > 0) {
    const bodyStr = deparseBody(elseClause.body, opts);
    parts.push(` {${opts.newline}${bodyStr}${opts.newline}}`);
  }

  if (elseClause.else) {
    parts.push(deparseElse(elseClause.else, opts));
  }

  return parts.join('');
}

export function deparseExpr(
  expr: Expr,
  opts: Required<DeparserOptions>
): string {
  const parts: string[] = [];

  if (expr.negated) {
    parts.push('not ');
  }

  if (expr.terms) {
    if (Array.isArray(expr.terms)) {
      parts.push(deparseTerms(expr.terms, opts));
    } else {
      parts.push(deparseTerm(expr.terms, opts));
    }
  }

  if (expr.with && expr.with.length > 0) {
    for (const w of expr.with) {
      parts.push(deparseWith(w, opts));
    }
  }

  return parts.join('');
}

export function deparseWith(
  withClause: With,
  opts: Required<DeparserOptions>
): string {
  const target = withClause.target ? deparseTerm(withClause.target, opts) : '';
  const value = withClause.value ? deparseTerm(withClause.value, opts) : '';
  return ` with ${target} as ${value}`;
}

export function deparseTerms(
  terms: Term[],
  opts: Required<DeparserOptions>
): string {
  if (terms.length === 0) return '';

  if (terms.length === 1) {
    return deparseTerm(terms[0], opts);
  }

  const first = terms[0];
  if (first.type === TermType.REF || first.type === TermType.VAR) {
    const funcName = deparseTermValue(first, opts);

    if (isInfixOperator(funcName)) {
      return deparseInfixCall(funcName, terms.slice(1), opts);
    }

    const args = terms.slice(1).map((t) => deparseTerm(t, opts));
    return `${funcName}(${args.join(', ')})`;
  }

  return terms.map((t) => deparseTerm(t, opts)).join(', ');
}

function isInfixOperator(name: string): boolean {
  return name in InfixOperators;
}

function deparseInfixCall(
  op: string,
  args: Term[],
  opts: Required<DeparserOptions>
): string {
  const symbol = InfixOperators[op] || op;
  const sp = opts.spaces ? ' ' : '';

  if (args.length === 2) {
    const left = deparseTerm(args[0], opts);
    const right = deparseTerm(args[1], opts);
    return `${left}${sp}${symbol}${sp}${right}`;
  }

  return args.map((t) => deparseTerm(t, opts)).join(` ${symbol} `);
}

export function deparseTerm(
  term: Term,
  opts: Required<DeparserOptions>
): string {
  if (!term) return '';

  const type = term.type;
  const value = term.value;

  switch (type) {
  case TermType.NULL:
    return 'null';

  case TermType.BOOLEAN:
    return value ? 'true' : 'false';

  case TermType.NUMBER:
    return String(value);

  case TermType.STRING:
    return deparseString(value as string);

  case TermType.VAR:
    return value as string;

  case TermType.REF:
    return deparseRef(value as Term[], opts);

  case TermType.CALL:
    return deparseCall(value as Term[], opts);

  case TermType.ARRAY:
    return deparseArray(value as Term[], opts);

  case TermType.SET:
    return deparseSet(value as Term[], opts);

  case TermType.OBJECT:
    return deparseObject(value as ObjectItem[], opts);

  case TermType.ARRAY_COMPREHENSION:
    return deparseArrayComprehension(value as ArrayComprehension, opts);

  case TermType.SET_COMPREHENSION:
    return deparseSetComprehension(value as SetComprehension, opts);

  case TermType.OBJECT_COMPREHENSION:
    return deparseObjectComprehension(value as ObjectComprehension, opts);

  default:
    return deparseTermValue(term, opts);
  }
}

function deparseTermValue(
  term: Term,
  opts: Required<DeparserOptions>
): string {
  if (!term) return '';

  if (term.type === TermType.VAR) {
    return term.value as string;
  }

  if (term.type === TermType.STRING) {
    return term.value as string;
  }

  if (term.type === TermType.REF) {
    return deparseRef(term.value as Term[], opts);
  }

  if (typeof term.value === 'string') {
    return term.value;
  }

  if (typeof term.value === 'number') {
    return String(term.value);
  }

  if (typeof term.value === 'boolean') {
    return term.value ? 'true' : 'false';
  }

  return deparseTerm(term, opts);
}

function deparseString(str: string): string {
  const escaped = str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

function deparseRef(ref: Term[], opts: Required<DeparserOptions>): string {
  if (!ref || ref.length === 0) return '';

  const parts: string[] = [];

  for (let i = 0; i < ref.length; i++) {
    const term = ref[i];

    if (i === 0) {
      parts.push(deparseTermValue(term, opts));
    } else if (term.type === TermType.STRING) {
      const key = term.value as string;
      if (isValidIdentifier(key)) {
        parts.push(`.${key}`);
      } else {
        parts.push(`[${deparseString(key)}]`);
      }
    } else if (term.type === TermType.VAR) {
      parts.push(`[${term.value}]`);
    } else {
      parts.push(`[${deparseTerm(term, opts)}]`);
    }
  }

  return parts.join('');
}

function isValidIdentifier(str: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str);
}

function deparseCall(call: Term[], opts: Required<DeparserOptions>): string {
  if (!call || call.length === 0) return '';

  const funcRef = call[0];
  const funcName = deparseTermValue(funcRef, opts);
  const args = call.slice(1).map((t) => deparseTerm(t, opts));

  return `${funcName}(${args.join(', ')})`;
}

function deparseArray(arr: Term[], opts: Required<DeparserOptions>): string {
  const elements = arr.map((t) => deparseTerm(t, opts));
  return `[${elements.join(', ')}]`;
}

function deparseSet(set: Term[], opts: Required<DeparserOptions>): string {
  if (set.length === 0) {
    return 'set()';
  }
  const elements = set.map((t) => deparseTerm(t, opts));
  return `{${elements.join(', ')}}`;
}

function deparseObject(
  obj: ObjectItem[],
  opts: Required<DeparserOptions>
): string {
  const entries = obj.map((item) => {
    const key = item.key ? deparseTerm(item.key, opts) : '';
    const value = item.value ? deparseTerm(item.value, opts) : '';
    return `${key}: ${value}`;
  });
  return `{${entries.join(', ')}}`;
}

function deparseArrayComprehension(
  comp: ArrayComprehension,
  opts: Required<DeparserOptions>
): string {
  const term = comp.term ? deparseTerm(comp.term, opts) : '';
  const body = comp.body ? deparseBodyInline(comp.body, opts) : '';
  return `[${term} | ${body}]`;
}

function deparseSetComprehension(
  comp: SetComprehension,
  opts: Required<DeparserOptions>
): string {
  const term = comp.term ? deparseTerm(comp.term, opts) : '';
  const body = comp.body ? deparseBodyInline(comp.body, opts) : '';
  return `{${term} | ${body}}`;
}

function deparseObjectComprehension(
  comp: ObjectComprehension,
  opts: Required<DeparserOptions>
): string {
  const key = comp.key ? deparseTerm(comp.key, opts) : '';
  const value = comp.value ? deparseTerm(comp.value, opts) : '';
  const body = comp.body ? deparseBodyInline(comp.body, opts) : '';
  return `{${key}: ${value} | ${body}}`;
}

function deparseBodyInline(
  body: Body,
  opts: Required<DeparserOptions>
): string {
  return body.map((expr) => deparseExpr(expr, opts)).join('; ');
}

export function deparseEvery(
  every: Every,
  opts: Required<DeparserOptions>
): string {
  const parts: string[] = ['every'];

  if (every.key) {
    parts.push(` ${deparseTerm(every.key, opts)},`);
  }

  if (every.value) {
    parts.push(` ${deparseTerm(every.value, opts)}`);
  }

  if (every.domain) {
    parts.push(` in ${deparseTerm(every.domain, opts)}`);
  }

  if (every.body && every.body.length > 0) {
    const bodyStr = deparseBody(every.body, opts);
    parts.push(` {${opts.newline}${bodyStr}${opts.newline}}`);
  }

  return parts.join('');
}
