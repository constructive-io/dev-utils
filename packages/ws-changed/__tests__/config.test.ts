import { rmSync, writeFileSync } from 'fs';
import { join } from 'path';

import { DEFAULT_CONFIG, loadConfig } from '../src/config';
import { buildWorkspace } from './support/build-workspace';

describe('loadConfig', () => {
  const roots: string[] = [];
  afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

  it('returns defaults when no config file is present', () => {
    const root = buildWorkspace({ packages: [] });
    roots.push(root);
    const { config } = loadConfig({ cwd: root });
    expect(config.provider).toBe(DEFAULT_CONFIG.provider);
  });

  it('discovers a .ws-changedrc.json and merges it over defaults', () => {
    const root = buildWorkspace({ packages: [] });
    roots.push(root);
    writeFileSync(
      join(root, '.ws-changedrc.json'),
      JSON.stringify({ provider: ['pnpm', 'pgpm'], global: ['pnpm-lock.yaml'] })
    );
    const { config, filepath } = loadConfig({ cwd: root });
    expect(config.provider).toEqual(['pnpm', 'pgpm']);
    expect(config.global).toEqual(['pnpm-lock.yaml']);
    expect(filepath).toContain('.ws-changedrc.json');
  });

  it('reads a ws-changed key from package.json', () => {
    const root = buildWorkspace({ packages: [], rootFiles: {} });
    roots.push(root);
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'root', 'ws-changed': { provider: 'glob' } })
    );
    const { config } = loadConfig({ cwd: root });
    expect(config.provider).toBe('glob');
  });

  it('lets runtime overrides win over the file', () => {
    const root = buildWorkspace({ packages: [] });
    roots.push(root);
    writeFileSync(join(root, '.ws-changedrc.json'), JSON.stringify({ provider: 'pnpm' }));
    const { config } = loadConfig({ cwd: root, overrides: { provider: 'pgpm' } });
    expect(config.provider).toBe('pgpm');
  });

  it('reads global triggers from the environment layer', () => {
    const root = buildWorkspace({ packages: [] });
    roots.push(root);
    const prev = process.env.WS_CHANGED_GLOBAL;
    process.env.WS_CHANGED_GLOBAL = 'pnpm-lock.yaml, .github/**';
    try {
      const { config } = loadConfig({ cwd: root });
      expect(config.global).toEqual(['pnpm-lock.yaml', '.github/**']);
    } finally {
      if (prev === undefined) delete process.env.WS_CHANGED_GLOBAL;
      else process.env.WS_CHANGED_GLOBAL = prev;
    }
  });
});
