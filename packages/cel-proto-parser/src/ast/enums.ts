import * as t from '@babel/types';

interface ProtoEnum {
  name: string;
  values: Record<string, number>;
}

/**
 * Convert a protobuf Enum to a TypeScript string union type
 */
export function convertEnumToTsUnionType(
  enumNode: ProtoEnum
): t.ExportNamedDeclaration {
  const enumName = enumNode.name;
  const values = enumNode.values;

  // Create string literal types for each enum value
  const unionTypes = Object.keys(values).map((key) =>
    t.tsLiteralType(t.stringLiteral(key))
  );

  const typeAlias = t.tsTypeAliasDeclaration(
    t.identifier(enumName),
    null,
    t.tsUnionType(unionTypes)
  );

  return t.exportNamedDeclaration(typeAlias, []);
}

/**
 * Convert a protobuf Enum to a TypeScript enum declaration
 */
export function convertEnumToTsEnumDeclaration(
  enumNode: ProtoEnum
): t.ExportNamedDeclaration {
  const enumName = enumNode.name;
  const values = enumNode.values;

  const members = Object.entries(values).map(([key, value]) =>
    t.tsEnumMember(t.identifier(key), t.numericLiteral(value))
  );

  const enumDecl = t.tsEnumDeclaration(t.identifier(enumName), members);

  return t.exportNamedDeclaration(enumDecl, []);
}
