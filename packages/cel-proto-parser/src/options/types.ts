/**
 * Options for CEL proto parser
 */

export interface CelProtoParserOptions {
  /** Output directory for generated files */
  outDir: string;

  /** List of type or enum names to exclude during processing */
  exclude?: string[];

  /** Parser options for protobufjs */
  parser?: {
    keepCase?: boolean;
  };

  /** Type generation options */
  types?: {
    /** Whether to generate TypeScript interfaces */
    enabled?: boolean;
    /** Filename for generated types */
    filename?: string;
    /** Whether all fields should be optional */
    optionalFields?: boolean;
    /** Source path for enum imports */
    enumsSource?: string;
  };

  /** Enum generation options */
  enums?: {
    /** Whether to generate TypeScript enums */
    enabled?: boolean;
    /** Filename for generated enums */
    filename?: string;
    /** Use string unions instead of enums */
    enumsAsTypeUnion?: boolean;
  };

  /** Utility generation options */
  utils?: {
    /** AST helper generation options */
    astHelpers?: {
      /** Whether to generate AST helpers */
      enabled?: boolean;
      /** Filename for generated helpers */
      filename?: string;
      /** Source path for type imports */
      typesSource?: string;
    };
  };

  /** Deparser generation options */
  deparser?: {
    /** Whether to generate deparser */
    enabled?: boolean;
    /** Filename for generated deparser */
    filename?: string;
    /** Source path for type imports */
    typesSource?: string;
  };
}

export interface ResolvedCelProtoParserOptions {
  outDir: string;
  exclude: string[];
  parser: {
    keepCase: boolean;
  };
  types: {
    enabled: boolean;
    filename: string;
    optionalFields: boolean;
    enumsSource: string;
  };
  enums: {
    enabled: boolean;
    filename: string;
    enumsAsTypeUnion: boolean;
  };
  utils: {
    astHelpers: {
      enabled: boolean;
      filename: string;
      typesSource: string;
    };
  };
  deparser: {
    enabled: boolean;
    filename: string;
    typesSource: string;
  };
}
