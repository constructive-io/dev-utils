import * as t from '@babel/types';
import { ResolvedCelProtoParserOptions } from '../options';
import { toCamelCase, getFieldName, createNamedImport } from '../utils';

// Type mapping from protobuf to TypeScript
const PROTO_TO_TS_TYPE: Record<string, string> = {
  string: 'string',
  bool: 'boolean',
  int32: 'number',
  int64: 'bigint',
  uint32: 'number',
  uint64: 'bigint',
  float: 'number',
  double: 'number',
  bytes: 'Uint8Array'
};

/**
 * Resolve a protobuf type name to a TypeScript type reference
 */
export function resolveTypeName(typeName: string): t.TSType {
  // Handle well-known Google protobuf types
  if (typeName.startsWith('google.protobuf.')) {
    const shortName = typeName.replace('google.protobuf.', '');
    // Return as a qualified type reference
    return t.tsTypeReference(
      t.tsQualifiedName(
        t.tsQualifiedName(t.identifier('google'), t.identifier('protobuf')),
        t.identifier(shortName)
      )
    );
  }

  // Handle primitive types
  const tsType = PROTO_TO_TS_TYPE[typeName];
  if (tsType) {
    switch (tsType) {
      case 'string':
        return t.tsStringKeyword();
      case 'boolean':
        return t.tsBooleanKeyword();
      case 'number':
        return t.tsNumberKeyword();
      case 'bigint':
        return t.tsBigIntKeyword();
      default:
        return t.tsTypeReference(t.identifier(tsType));
    }
  }

  // Handle custom types (reference to other interfaces)
  return t.tsTypeReference(t.identifier(typeName));
}

/**
 * Generate import statements for enums
 */
export function generateEnumImports(
  enums: Array<{ name: string }>,
  source: string
): t.ImportDeclaration {
  return createNamedImport(
    enums.map((e) => e.name),
    source
  );
}

/**
 * Generate a Node union type that includes all AST node types
 */
export function generateNodeUnionType(
  types: Array<{ name: string }>
): t.ExportNamedDeclaration {
  // Generate wrapped object types: { TypeName: TypeName }
  const unionTypeNames = types.map((type) =>
    t.tsTypeLiteral([
      t.tsPropertySignature(
        t.identifier(type.name),
        t.tsTypeAnnotation(t.tsTypeReference(t.identifier(type.name)))
      )
    ])
  );

  const unionTypeAlias = t.tsTypeAliasDeclaration(
    t.identifier('Node'),
    null,
    t.tsUnionType(unionTypeNames)
  );

  return t.exportNamedDeclaration(unionTypeAlias, []);
}

interface ProtoField {
  name: string;
  type: string;
  rule?: string;
}

interface ProtoType {
  name: string;
  fields: Record<string, ProtoField>;
}

/**
 * Convert a protobuf Type to a TypeScript interface
 */
export function convertTypeToTsInterface(
  type: ProtoType,
  options: ResolvedCelProtoParserOptions
): t.ExportNamedDeclaration {
  const typeName = type.name;
  const fields = type.fields;

  const properties = Object.entries(fields).map(([fieldName, field]) => {
    const resolvedType = resolveTypeName(field.type);
    const fieldType =
      field.rule === 'repeated' ? t.tsArrayType(resolvedType) : resolvedType;

    const prop = t.tsPropertySignature(
      t.identifier(getFieldName(field, fieldName)),
      t.tsTypeAnnotation(fieldType)
    );
    prop.optional = options.types.optionalFields;
    return prop;
  });

  const interfaceDecl = t.tsInterfaceDeclaration(
    t.identifier(typeName),
    null,
    [],
    t.tsInterfaceBody(properties)
  );

  return t.exportNamedDeclaration(interfaceDecl, []);
}

/**
 * Generate AST helper factory methods
 */
export function generateAstHelperMethods(
  types: ProtoType[]
): t.ExportDefaultDeclaration {
  const creators = types.map((type) => {
    const typeName = type.name;
    const param = t.identifier('_p');
    param.optional = true;
    param.typeAnnotation = t.tsTypeAnnotation(
      t.tsTypeReference(t.identifier(typeName))
    );

    const fields = type.fields;

    // const _j = {} as TypeName;
    const astNodeInit = t.variableDeclaration('const', [
      t.variableDeclarator(
        t.identifier('_j'),
        t.tsAsExpression(
          t.objectExpression([]),
          t.tsTypeReference(t.identifier(typeName))
        )
      )
    ]);

    // _o.set(_j, 'fieldName', _p?.fieldName);
    const setStatements = Object.entries(fields).map(([fName, field]) => {
      const fieldName = getFieldName(field, fName);
      return t.expressionStatement(
        t.callExpression(
          t.memberExpression(t.identifier('_o'), t.identifier('set')),
          [
            t.identifier('_j'),
            t.stringLiteral(fieldName),
            t.optionalMemberExpression(
              t.identifier('_p'),
              t.identifier(fieldName),
              false,
              true
            )
          ]
        )
      );
    });

    const methodName = toCamelCase(typeName);

    const method = t.objectMethod(
      'method',
      t.identifier(methodName),
      [param],
      t.blockStatement([
        astNodeInit,
        ...setStatements,
        t.returnStatement(t.identifier('_j'))
      ])
    );

    method.returnType = t.tsTypeAnnotation(
      t.tsTypeReference(t.identifier(typeName))
    );

    return method;
  });

  return t.exportDefaultDeclaration(t.objectExpression(creators));
}

/**
 * Generate import specifiers for types
 */
export function generateTypeImportSpecifiers(
  types: ProtoType[],
  options: ResolvedCelProtoParserOptions
): t.ImportDeclaration {
  const importSpecifiers = types.map((type) =>
    t.importSpecifier(t.identifier(type.name), t.identifier(type.name))
  );
  return t.importDeclaration(
    importSpecifiers,
    t.stringLiteral(options.utils.astHelpers.typesSource)
  );
}
