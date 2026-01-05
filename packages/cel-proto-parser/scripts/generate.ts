import { join, resolve } from 'path';
import { CelProtoParser, CelProtoParserOptions } from '../src';

const inFile: string = join(__dirname, '../__fixtures__/syntax.proto');
const outDir: string = resolve(join(__dirname, '../src/generated'));

const options: CelProtoParserOptions = {
  outDir,
  types: {
    enabled: true,
    filename: 'types.ts',
    optionalFields: true
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

const parser = new CelProtoParser(inFile, options);
parser.write();

console.log('CEL types generated successfully!');
console.log(`Output directory: ${outDir}`);
