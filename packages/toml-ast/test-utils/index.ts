import * as fs from 'fs';
import * as path from 'path';

export function readFixture(fixturePath: string): string {
  const fullPath = path.resolve(__dirname, '../../../__fixtures__', fixturePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

export function getFixtures(dir: string): string[] {
  const fullPath = path.resolve(__dirname, '../../../__fixtures__', dir);
  if (!fs.existsSync(fullPath)) {
    return [];
  }
  return fs.readdirSync(fullPath)
    .filter((file) => file.endsWith('.toml'))
    .map((file) => path.join(dir, file));
}

export function normalizeWhitespace(str: string): string {
  return str
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .join('\n');
}
