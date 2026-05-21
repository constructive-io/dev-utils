import fs from 'node:fs';
import path from 'node:path';

import { createFetch, isLocalhostSubdomain } from '../src/localhost-fetch.browser';

describe('browser build — static analysis', () => {
  const distDir = path.resolve(__dirname, '../dist');

  const browserFiles = [
    'index.browser.js',
    'localhost-fetch.browser.js',
    path.join('esm', 'index.browser.js'),
    path.join('esm', 'localhost-fetch.browser.js'),
  ];

  it.each(browserFiles)('%s contains no node: scheme imports', (file) => {
    const filePath = path.join(distDir, file);
    if (!fs.existsSync(filePath)) {
      // In CI, missing artifacts must fail — otherwise this regression
      // check silently passes when tests run before the build step.
      if (process.env.CI) {
        throw new Error(
          `Built artifact missing: ${filePath} — run 'makage build' before tests in CI`,
        );
      }
      console.warn(`SKIP: ${filePath} not found (run 'makage build' first)`);
      return;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    // Catch any node: URI scheme import (node:http, node:https, node:crypto, ...)
    expect(content).not.toMatch(/['"]node:[a-z]+['"]/);
    expect(content).not.toContain("require('node:");
    expect(content).not.toContain('require("node:');
  });
});

describe('browser build — createFetch behavior', () => {
  it('returns a function', () => {
    const fetch = createFetch();
    expect(typeof fetch).toBe('function');
  });

  it('returns the same instance on repeated calls', () => {
    const a = createFetch();
    const b = createFetch();
    expect(a).toBe(b);
  });

  it('delegates to globalThis.fetch', async () => {
    // The shim caches the bound fetch at module scope, so to observe the spy
    // we must load a fresh module instance *after* installing the spy.
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('ok'));
    try {
      await jest.isolateModulesAsync(async () => {
        const { createFetch: freshCreateFetch } = await import(
          '../src/localhost-fetch.browser'
        );
        const fetch = freshCreateFetch();
        const res = await fetch('https://example.com');
        expect(spy).toHaveBeenCalledWith('https://example.com');
        expect(await res.text()).toBe('ok');
      });
    } finally {
      spy.mockRestore();
    }
  });
});

describe('browser build — isLocalhostSubdomain', () => {
  it('returns true for *.localhost', () => {
    expect(isLocalhostSubdomain('auth.localhost')).toBe(true);
    expect(isLocalhostSubdomain('api.localhost')).toBe(true);
  });

  it('returns false for bare localhost', () => {
    expect(isLocalhostSubdomain('localhost')).toBe(false);
  });

  it('returns false for non-localhost', () => {
    expect(isLocalhostSubdomain('example.com')).toBe(false);
  });
});
