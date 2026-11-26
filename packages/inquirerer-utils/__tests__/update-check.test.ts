import { appstash } from 'appstash';
import * as fs from 'fs';
import * as http from 'http';
import { AddressInfo } from 'net';
import * as os from 'os';
import * as path from 'path';

import { checkForUpdates, suppressUpdateCheck } from '../src';

const posix = process.platform !== 'win32';
const mode = (dir: string): number => fs.statSync(dir).mode & 0o777;

describe('the directories the update check creates', () => {
  let server: http.Server;
  let registry: string;
  let base: string;
  const savedBase = process.env.APPSTASH_BASE_DIR;

  beforeAll(async () => {
    server = http.createServer((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ version: '9.9.9' }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    registry = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'inquirerer-utils-update-'));
    process.env.APPSTASH_BASE_DIR = base;
  });

  afterEach(() => {
    if (savedBase === undefined) delete process.env.APPSTASH_BASE_DIR;
    else process.env.APPSTASH_BASE_DIR = savedBase;
    fs.rmSync(base, { recursive: true, force: true });
  });

  const check = () => checkForUpdates({ pkgName: 'demo-cli', pkgVersion: '1.0.0', toolName: 'demo', registryBaseUrl: registry, force: true });
  const dirs = () => appstash('demo', { baseDir: base });

  (posix ? it.each : it.skip.each)([
    ['the update check', async () => { await check(); }],
    ['suppressUpdateCheck', async () => { suppressUpdateCheck('demo', '1.0.0'); }]
  ])('%s creates only the cache directory, with the tool directory, at mode 0700', async (_caller, run) => {
    await run();
    const { root, cache } = dirs();
    expect(fs.existsSync(path.join(cache, 'update-check.json'))).toBe(true);
    expect(fs.readdirSync(root)).toEqual(['cache']);
    expect([mode(root), mode(cache)]).toEqual([0o700, 0o700]);
  });
});
