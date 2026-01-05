import { CelProtoParserOptions, ResolvedCelProtoParserOptions } from './types';

const defaultOptions: ResolvedCelProtoParserOptions = {
  outDir: process.cwd() + '/out',
  exclude: [],
  parser: {
    keepCase: false
  },
  types: {
    enabled: true,
    filename: 'types.ts',
    optionalFields: true,
    enumsSource: './enums'
  },
  enums: {
    enabled: true,
    filename: 'enums.ts',
    enumsAsTypeUnion: true
  },
  utils: {
    astHelpers: {
      enabled: true,
      filename: 'asts.ts',
      typesSource: './types'
    }
  },
  deparser: {
    enabled: true,
    filename: 'deparser.ts',
    typesSource: './types'
  }
};

export function getOptionsWithDefaults(
  options?: CelProtoParserOptions
): ResolvedCelProtoParserOptions {
  if (!options) {
    return { ...defaultOptions };
  }

  return {
    outDir: options.outDir ?? defaultOptions.outDir,
    exclude: options.exclude ?? defaultOptions.exclude,
    parser: {
      keepCase: options.parser?.keepCase ?? defaultOptions.parser.keepCase
    },
    types: {
      enabled: options.types?.enabled ?? defaultOptions.types.enabled,
      filename: options.types?.filename ?? defaultOptions.types.filename,
      optionalFields:
        options.types?.optionalFields ?? defaultOptions.types.optionalFields,
      enumsSource: options.types?.enumsSource ?? defaultOptions.types.enumsSource
    },
    enums: {
      enabled: options.enums?.enabled ?? defaultOptions.enums.enabled,
      filename: options.enums?.filename ?? defaultOptions.enums.filename,
      enumsAsTypeUnion:
        options.enums?.enumsAsTypeUnion ?? defaultOptions.enums.enumsAsTypeUnion
    },
    utils: {
      astHelpers: {
        enabled:
          options.utils?.astHelpers?.enabled ??
          defaultOptions.utils.astHelpers.enabled,
        filename:
          options.utils?.astHelpers?.filename ??
          defaultOptions.utils.astHelpers.filename,
        typesSource:
          options.utils?.astHelpers?.typesSource ??
          defaultOptions.utils.astHelpers.typesSource
      }
    },
    deparser: {
      enabled: options.deparser?.enabled ?? defaultOptions.deparser.enabled,
      filename: options.deparser?.filename ?? defaultOptions.deparser.filename,
      typesSource:
        options.deparser?.typesSource ?? defaultOptions.deparser.typesSource
    }
  };
}
