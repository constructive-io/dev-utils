import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { appstash, createConfigStore } from '../src';

describe('createConfigStore', () => {
  let tempBase: string;

  beforeEach(() => {
    tempBase = fs.mkdtempSync(path.join(os.tmpdir(), 'appstash-config-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempBase)) {
      fs.rmSync(tempBase, { recursive: true, force: true });
    }
  });

  function createStore(toolName = 'testapp') {
    return createConfigStore(toolName, { baseDir: tempBase });
  }

  describe('settings', () => {
    it('should return default settings when none exist', () => {
      const store = createStore();
      const settings = store.loadSettings();
      expect(settings).toEqual({});
    });

    it('should save and load settings', () => {
      const store = createStore();
      store.saveSettings({ currentContext: 'production' });
      const settings = store.loadSettings();
      expect(settings.currentContext).toBe('production');
    });

    it('should overwrite existing settings', () => {
      const store = createStore();
      store.saveSettings({ currentContext: 'staging' });
      store.saveSettings({ currentContext: 'production' });
      const settings = store.loadSettings();
      expect(settings.currentContext).toBe('production');
    });
  });

  describe('context management', () => {
    it('should create a context', () => {
      const store = createStore();
      const ctx = store.createContext('production', { endpoint: 'https://api.example.com/graphql' });
      expect(ctx.name).toBe('production');
      expect(ctx.endpoint).toBe('https://api.example.com/graphql');
      expect(ctx.createdAt).toBeDefined();
      expect(ctx.updatedAt).toBeDefined();
    });

    it('should load a created context', () => {
      const store = createStore();
      store.createContext('production', { endpoint: 'https://api.example.com/graphql' });
      const ctx = store.loadContext('production');
      expect(ctx).not.toBeNull();
      expect(ctx!.name).toBe('production');
      expect(ctx!.endpoint).toBe('https://api.example.com/graphql');
    });

    it('should return null for non-existent context', () => {
      const store = createStore();
      const ctx = store.loadContext('nonexistent');
      expect(ctx).toBeNull();
    });

    it('should list all contexts', () => {
      const store = createStore();
      store.createContext('production', { endpoint: 'https://api.example.com/graphql' });
      store.createContext('staging', { endpoint: 'https://staging.example.com/graphql' });
      const contexts = store.listContexts();
      expect(contexts).toHaveLength(2);
      const names = contexts.map(c => c.name).sort();
      expect(names).toEqual(['production', 'staging']);
    });

    it('should return empty list when no contexts exist', () => {
      const store = createStore();
      const contexts = store.listContexts();
      expect(contexts).toEqual([]);
    });

    it('should delete a context', () => {
      const store = createStore();
      store.createContext('production', { endpoint: 'https://api.example.com/graphql' });
      const deleted = store.deleteContext('production');
      expect(deleted).toBe(true);
      expect(store.loadContext('production')).toBeNull();
    });

    it('should return false when deleting non-existent context', () => {
      const store = createStore();
      const deleted = store.deleteContext('nonexistent');
      expect(deleted).toBe(false);
    });

    it('should clear currentContext when deleting the active context', () => {
      const store = createStore();
      store.createContext('production', { endpoint: 'https://api.example.com/graphql' });
      store.setCurrentContext('production');
      store.deleteContext('production');
      const settings = store.loadSettings();
      expect(settings.currentContext).toBeUndefined();
    });
  });

  describe('current context', () => {
    it('should return null when no current context is set', () => {
      const store = createStore();
      const ctx = store.getCurrentContext();
      expect(ctx).toBeNull();
    });

    it('should set and get current context', () => {
      const store = createStore();
      store.createContext('production', { endpoint: 'https://api.example.com/graphql' });
      const result = store.setCurrentContext('production');
      expect(result).toBe(true);
      const ctx = store.getCurrentContext();
      expect(ctx).not.toBeNull();
      expect(ctx!.name).toBe('production');
    });

    it('should return false when setting non-existent context as current', () => {
      const store = createStore();
      const result = store.setCurrentContext('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('credentials', () => {
    it('should return null for non-existent credentials', () => {
      const store = createStore();
      const creds = store.getCredentials('production');
      expect(creds).toBeNull();
    });

    it('should set and get credentials', () => {
      const store = createStore();
      store.setCredentials('production', { token: 'abc123' });
      const creds = store.getCredentials('production');
      expect(creds).not.toBeNull();
      expect(creds!.token).toBe('abc123');
    });

    it('should store optional credential fields', () => {
      const store = createStore();
      store.setCredentials('production', {
        token: 'abc123',
        expiresAt: '2099-12-31T23:59:59Z',
        refreshToken: 'refresh456',
      });
      const creds = store.getCredentials('production');
      expect(creds!.expiresAt).toBe('2099-12-31T23:59:59Z');
      expect(creds!.refreshToken).toBe('refresh456');
    });

    it('should overwrite existing credentials', () => {
      const store = createStore();
      store.setCredentials('production', { token: 'old' });
      store.setCredentials('production', { token: 'new' });
      const creds = store.getCredentials('production');
      expect(creds!.token).toBe('new');
    });

    it('should remove credentials', () => {
      const store = createStore();
      store.setCredentials('production', { token: 'abc123' });
      const removed = store.removeCredentials('production');
      expect(removed).toBe(true);
      expect(store.getCredentials('production')).toBeNull();
    });

    it('should return false when removing non-existent credentials', () => {
      const store = createStore();
      const removed = store.removeCredentials('production');
      expect(removed).toBe(false);
    });

    it('should keep credentials for other contexts when removing one', () => {
      const store = createStore();
      store.setCredentials('production', { token: 'prod-token' });
      store.setCredentials('staging', { token: 'staging-token' });
      store.removeCredentials('production');
      expect(store.getCredentials('production')).toBeNull();
      expect(store.getCredentials('staging')!.token).toBe('staging-token');
    });
  });

  describe('hasValidCredentials', () => {
    it('should return false when no credentials exist', () => {
      const store = createStore();
      expect(store.hasValidCredentials('production')).toBe(false);
    });

    it('should return true for valid non-expiring token', () => {
      const store = createStore();
      store.setCredentials('production', { token: 'abc123' });
      expect(store.hasValidCredentials('production')).toBe(true);
    });

    it('should return true for token with future expiry', () => {
      const store = createStore();
      store.setCredentials('production', {
        token: 'abc123',
        expiresAt: '2099-12-31T23:59:59Z',
      });
      expect(store.hasValidCredentials('production')).toBe(true);
    });

    it('should return false for expired token', () => {
      const store = createStore();
      store.setCredentials('production', {
        token: 'abc123',
        expiresAt: '2020-01-01T00:00:00Z',
      });
      expect(store.hasValidCredentials('production')).toBe(false);
    });

    it('should return false for empty token', () => {
      const store = createStore();
      store.setCredentials('production', { token: '' });
      expect(store.hasValidCredentials('production')).toBe(false);
    });
  });

  describe('isolation between tools', () => {
    it('should isolate config between different tool names', () => {
      const store1 = createStore('app1');
      const store2 = createStore('app2');

      store1.createContext('production', { endpoint: 'https://app1.example.com/graphql' });
      store2.createContext('production', { endpoint: 'https://app2.example.com/graphql' });

      const ctx1 = store1.loadContext('production');
      const ctx2 = store2.loadContext('production');

      expect(ctx1!.endpoint).toBe('https://app1.example.com/graphql');
      expect(ctx2!.endpoint).toBe('https://app2.example.com/graphql');
    });

    it('should isolate credentials between different tool names', () => {
      const store1 = createStore('app1');
      const store2 = createStore('app2');

      store1.setCredentials('production', { token: 'token1' });
      store2.setCredentials('production', { token: 'token2' });

      expect(store1.getCredentials('production')!.token).toBe('token1');
      expect(store2.getCredentials('production')!.token).toBe('token2');
    });
  });

  describe('multi-target contexts', () => {
    it('should create a context with targets', () => {
      const store = createStore();
      const ctx = store.createContext('production', {
        endpoint: 'https://api.example.com/graphql',
        targets: {
          auth: { endpoint: 'https://auth.example.com/graphql' },
          members: { endpoint: 'https://members.example.com/graphql' },
          app: { endpoint: 'https://app.example.com/graphql' },
        },
      });
      expect(ctx.targets).toBeDefined();
      expect(ctx.targets!.auth.endpoint).toBe('https://auth.example.com/graphql');
      expect(ctx.targets!.members.endpoint).toBe('https://members.example.com/graphql');
      expect(ctx.targets!.app.endpoint).toBe('https://app.example.com/graphql');
    });

    it('should load a context with targets', () => {
      const store = createStore();
      store.createContext('production', {
        endpoint: 'https://api.example.com/graphql',
        targets: {
          auth: { endpoint: 'https://auth.example.com/graphql' },
        },
      });
      const ctx = store.loadContext('production');
      expect(ctx!.targets!.auth.endpoint).toBe('https://auth.example.com/graphql');
    });

    it('should create a context without targets (backward compatible)', () => {
      const store = createStore();
      const ctx = store.createContext('production', {
        endpoint: 'https://api.example.com/graphql',
      });
      expect(ctx.targets).toBeUndefined();
    });

    it('should get target endpoint from multi-target context', () => {
      const store = createStore();
      store.createContext('production', {
        endpoint: 'https://api.example.com/graphql',
        targets: {
          auth: { endpoint: 'https://auth.example.com/graphql' },
          app: { endpoint: 'https://app.example.com/graphql' },
        },
      });
      store.setCurrentContext('production');
      expect(store.getTargetEndpoint('auth')).toBe('https://auth.example.com/graphql');
      expect(store.getTargetEndpoint('app')).toBe('https://app.example.com/graphql');
    });

    it('should fall back to main endpoint for unknown target', () => {
      const store = createStore();
      store.createContext('production', {
        endpoint: 'https://api.example.com/graphql',
        targets: {
          auth: { endpoint: 'https://auth.example.com/graphql' },
        },
      });
      store.setCurrentContext('production');
      expect(store.getTargetEndpoint('unknown')).toBe('https://api.example.com/graphql');
    });

    it('should fall back to main endpoint for single-target context', () => {
      const store = createStore();
      store.createContext('production', {
        endpoint: 'https://api.example.com/graphql',
      });
      store.setCurrentContext('production');
      expect(store.getTargetEndpoint('anything')).toBe('https://api.example.com/graphql');
    });

    it('should return null when no current context for getTargetEndpoint', () => {
      const store = createStore();
      expect(store.getTargetEndpoint('auth')).toBeNull();
    });

    it('should get target endpoint by explicit context name', () => {
      const store = createStore();
      store.createContext('staging', {
        endpoint: 'https://staging.example.com/graphql',
        targets: {
          auth: { endpoint: 'https://auth.staging.example.com/graphql' },
        },
      });
      expect(store.getTargetEndpoint('auth', 'staging')).toBe('https://auth.staging.example.com/graphql');
    });
  });

  describe('vars (key-value store)', () => {
    it('should return null for getVar when no context is active', () => {
      const store = createStore();
      expect(store.getVar('orgId')).toBeNull();
    });

    it('should throw on setVar when no context is active', () => {
      const store = createStore();
      expect(() => store.setVar('orgId', 'abc-123')).toThrow('No active context');
    });

    it('should set and get a var in the current context', () => {
      const store = createStore();
      store.createContext('production', { endpoint: 'https://api.example.com/graphql' });
      store.setCurrentContext('production');
      store.setVar('orgId', 'abc-123');
      expect(store.getVar('orgId')).toBe('abc-123');
    });

    it('should set and get a var by explicit context name', () => {
      const store = createStore();
      store.createContext('staging', { endpoint: 'https://staging.example.com/graphql' });
      store.setVar('orgId', 'staging-org', 'staging');
      expect(store.getVar('orgId', 'staging')).toBe('staging-org');
    });

    it('should overwrite existing var', () => {
      const store = createStore();
      store.createContext('production', { endpoint: 'https://api.example.com/graphql' });
      store.setCurrentContext('production');
      store.setVar('orgId', 'old');
      store.setVar('orgId', 'new');
      expect(store.getVar('orgId')).toBe('new');
    });

    it('should return null for non-existent var', () => {
      const store = createStore();
      store.createContext('production', { endpoint: 'https://api.example.com/graphql' });
      store.setCurrentContext('production');
      expect(store.getVar('nonexistent')).toBeNull();
    });

    it('should delete a var', () => {
      const store = createStore();
      store.createContext('production', { endpoint: 'https://api.example.com/graphql' });
      store.setCurrentContext('production');
      store.setVar('orgId', 'abc-123');
      const deleted = store.deleteVar('orgId');
      expect(deleted).toBe(true);
      expect(store.getVar('orgId')).toBeNull();
    });

    it('should return false when deleting non-existent var', () => {
      const store = createStore();
      store.createContext('production', { endpoint: 'https://api.example.com/graphql' });
      store.setCurrentContext('production');
      expect(store.deleteVar('nonexistent')).toBe(false);
    });

    it('should return false for deleteVar when no context is active', () => {
      const store = createStore();
      expect(store.deleteVar('orgId')).toBe(false);
    });

    it('should list all vars for current context', () => {
      const store = createStore();
      store.createContext('production', { endpoint: 'https://api.example.com/graphql' });
      store.setCurrentContext('production');
      store.setVar('orgId', 'abc-123');
      store.setVar('defaultDatabase', 'my-app');
      const vars = store.listVars();
      expect(vars).toEqual({ orgId: 'abc-123', defaultDatabase: 'my-app' });
    });

    it('should return empty object for listVars when no context is active', () => {
      const store = createStore();
      expect(store.listVars()).toEqual({});
    });

    it('should isolate vars between contexts', () => {
      const store = createStore();
      store.createContext('production', { endpoint: 'https://api.example.com/graphql' });
      store.createContext('staging', { endpoint: 'https://staging.example.com/graphql' });

      store.setVar('orgId', 'prod-org', 'production');
      store.setVar('orgId', 'staging-org', 'staging');

      expect(store.getVar('orgId', 'production')).toBe('prod-org');
      expect(store.getVar('orgId', 'staging')).toBe('staging-org');
    });
  });

  describe('getClientConfig', () => {
    it('should return endpoint and auth header from store', () => {
      const store = createStore();
      store.createContext('production', {
        endpoint: 'https://api.example.com/graphql',
        targets: {
          auth: { endpoint: 'https://auth.example.com/graphql' },
          public: { endpoint: 'https://public.example.com/graphql' },
        },
      });
      store.setCurrentContext('production');
      store.setCredentials('production', { token: 'my-jwt-token' });

      const config = store.getClientConfig('auth');
      expect(config.endpoint).toBe('https://auth.example.com/graphql');
      expect(config.headers['Authorization']).toBe('Bearer my-jwt-token');
    });

    it('should return config for explicit context name', () => {
      const store = createStore();
      store.createContext('staging', {
        endpoint: 'https://staging.example.com/graphql',
        targets: {
          public: { endpoint: 'https://public.staging.example.com/graphql' },
        },
      });
      store.setCredentials('staging', { token: 'staging-token' });

      const config = store.getClientConfig('public', 'staging');
      expect(config.endpoint).toBe('https://public.staging.example.com/graphql');
      expect(config.headers['Authorization']).toBe('Bearer staging-token');
    });

    it('should return config without auth header when no credentials', () => {
      const store = createStore();
      store.createContext('production', {
        endpoint: 'https://api.example.com/graphql',
      });
      store.setCurrentContext('production');

      const config = store.getClientConfig('public');
      expect(config.endpoint).toBe('https://api.example.com/graphql');
      expect(config.headers['Authorization']).toBeUndefined();
    });

    it('should fall back to env vars when no context exists', () => {
      const store = createStore();
      process.env['TESTAPP_PUBLIC_ENDPOINT'] = 'https://env.example.com/graphql';
      process.env['TESTAPP_TOKEN'] = 'env-token';

      try {
        const config = store.getClientConfig('public');
        expect(config.endpoint).toBe('https://env.example.com/graphql');
        expect(config.headers['Authorization']).toBe('Bearer env-token');
      } finally {
        delete process.env['TESTAPP_PUBLIC_ENDPOINT'];
        delete process.env['TESTAPP_TOKEN'];
      }
    });

    it('should fall back to generic endpoint env var', () => {
      const store = createStore();
      process.env['TESTAPP_ENDPOINT'] = 'https://generic.example.com/graphql';

      try {
        const config = store.getClientConfig('auth');
        expect(config.endpoint).toBe('https://generic.example.com/graphql');
        expect(config.headers['Authorization']).toBeUndefined();
      } finally {
        delete process.env['TESTAPP_ENDPOINT'];
      }
    });

    it('should prefer target-specific env var over generic', () => {
      const store = createStore();
      process.env['TESTAPP_AUTH_ENDPOINT'] = 'https://auth-specific.example.com/graphql';
      process.env['TESTAPP_ENDPOINT'] = 'https://generic.example.com/graphql';
      process.env['TESTAPP_TOKEN'] = 'env-token';

      try {
        const config = store.getClientConfig('auth');
        expect(config.endpoint).toBe('https://auth-specific.example.com/graphql');
      } finally {
        delete process.env['TESTAPP_AUTH_ENDPOINT'];
        delete process.env['TESTAPP_ENDPOINT'];
        delete process.env['TESTAPP_TOKEN'];
      }
    });

    it('should throw with actionable error when nothing is configured', () => {
      const store = createStore();
      expect(() => store.getClientConfig('public')).toThrow(
        /No configuration found for target "public"/
      );
      expect(() => store.getClientConfig('public')).toThrow(
        /TESTAPP_PUBLIC_ENDPOINT/
      );
    });

    it('should prioritize store over env vars', () => {
      const store = createStore();
      store.createContext('production', {
        endpoint: 'https://api.example.com/graphql',
        targets: {
          public: { endpoint: 'https://store.example.com/graphql' },
        },
      });
      store.setCurrentContext('production');
      store.setCredentials('production', { token: 'store-token' });
      process.env['TESTAPP_PUBLIC_ENDPOINT'] = 'https://env.example.com/graphql';
      process.env['TESTAPP_TOKEN'] = 'env-token';

      try {
        const config = store.getClientConfig('public');
        expect(config.endpoint).toBe('https://store.example.com/graphql');
        expect(config.headers['Authorization']).toBe('Bearer store-token');
      } finally {
        delete process.env['TESTAPP_PUBLIC_ENDPOINT'];
        delete process.env['TESTAPP_TOKEN'];
      }
    });

    it('should fall back to main endpoint when target not in store targets', () => {
      const store = createStore();
      store.createContext('production', {
        endpoint: 'https://api.example.com/graphql',
        targets: {
          auth: { endpoint: 'https://auth.example.com/graphql' },
        },
      });
      store.setCurrentContext('production');

      const config = store.getClientConfig('public');
      expect(config.endpoint).toBe('https://api.example.com/graphql');
    });
  });

  describe('full workflow', () => {
    it('should support the complete context + auth workflow', () => {
      const store = createStore();

      // Create contexts
      store.createContext('production', { endpoint: 'https://api.example.com/graphql' });
      store.createContext('staging', { endpoint: 'https://staging.example.com/graphql' });

      // Set current context
      store.setCurrentContext('production');
      expect(store.getCurrentContext()!.name).toBe('production');

      // Set credentials
      store.setCredentials('production', { token: 'prod-token' });
      expect(store.hasValidCredentials('production')).toBe(true);

      // Switch context
      store.setCurrentContext('staging');
      expect(store.getCurrentContext()!.name).toBe('staging');
      expect(store.hasValidCredentials('staging')).toBe(false);

      // Auth staging
      store.setCredentials('staging', { token: 'staging-token' });
      expect(store.hasValidCredentials('staging')).toBe(true);

      // List contexts
      const contexts = store.listContexts();
      expect(contexts).toHaveLength(2);

      // Logout from production
      store.removeCredentials('production');
      expect(store.hasValidCredentials('production')).toBe(false);
      expect(store.hasValidCredentials('staging')).toBe(true);

      // Delete staging
      store.deleteContext('staging');
      expect(store.listContexts()).toHaveLength(1);
      expect(store.getCurrentContext()).toBeNull();
    });
  });

  describe('context names', () => {
    const configDir = () => appstash('testapp', { baseDir: tempBase }).config;
    const contextsDir = () => path.join(configDir(), 'contexts');

    it('refuses a name that would overwrite settings.json', () => {
      const store = createStore();
      store.saveSettings({ currentContext: 'production' });
      expect(() => store.createContext('../settings', { endpoint: 'https://evil.example.com' })).toThrow('"../settings" is not a valid context name');
      expect(store.loadSettings()).toEqual({ currentContext: 'production' });
    });

    it.each([
      ['../../../victim', () => path.join(contextsDir(), '../../../victim.json')],
      ['../credentials', () => path.join(configDir(), 'credentials.json')]
    ])('refuses to delete the file %s names', (name, target) => {
      const store = createStore();
      store.setCredentials('production', { token: 'keep-me' });
      fs.mkdirSync(path.dirname(target()), { recursive: true });
      if (!fs.existsSync(target())) fs.writeFileSync(target(), '{}');
      expect(() => store.deleteContext(name)).toThrow('is not a valid context name');
      expect(fs.existsSync(target())).toBe(true);
      expect(store.getCredentials('production')).toMatchObject({ token: 'keep-me' });
    });

    it('refuses to read credentials.json as a context', () => {
      const store = createStore();
      store.setCredentials('production', { token: 'keep-me' });
      expect(() => store.loadContext('../credentials')).toThrow('is not a valid context name');
      expect(() => store.setCurrentContext('../credentials')).toThrow('is not a valid context name');
    });

    const requiredNameCalls = (store: ReturnType<typeof createStore>, name: string): Array<() => unknown> => [
      () => store.createContext(name, { endpoint: 'https://api.example.com' }),
      () => store.loadContext(name),
      () => store.deleteContext(name),
      () => store.setCurrentContext(name),
      () => store.setCredentials(name, { token: 't' }),
      () => store.getCredentials(name),
      () => store.removeCredentials(name),
      () => store.hasValidCredentials(name)
    ];

    it.each(['.', '..', 'a/b', 'a\\b', 'a\0b'])('refuses %j in every method that takes a context name', (name) => {
      const store = createStore();
      const calls = [
        ...requiredNameCalls(store, name),
        () => store.setVar('k', 'v', name),
        () => store.getVar('k', name),
        () => store.listVars(name)
      ];
      for (const call of calls) expect(call).toThrow('is not a valid context name');
    });

    it('refuses an empty name in every method that requires a name', () => {
      const store = createStore();
      for (const call of requiredNameCalls(store, '')) expect(call).toThrow('is not a valid context name');
    });

    it.each(['my app', 'prod:eu', 'user@example.com', `${'o'.repeat(30)}%2F${'r'.repeat(80)}`])(
      'keeps %j working for write, read and delete',
      (name) => {
        const store = createStore();
        store.createContext(name, { endpoint: 'https://api.example.com' });
        store.setCurrentContext(name);
        store.setCredentials(name, { token: 't' });
        store.setVar('k', 'v', name);
        expect(store.getCurrentContext()).toMatchObject({ name, endpoint: 'https://api.example.com' });
        expect(store.getCredentials(name)).toMatchObject({ token: 't' });
        expect(store.getVar('k')).toBe('v');
        expect(store.removeCredentials(name)).toBe(true);
        expect(store.deleteContext(name)).toBe(true);
        expect(store.listContexts()).toEqual([]);
      }
    );

    it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])('keeps %j as a plain key, never a member of Object.prototype', (name) => {
      const store = createStore();
      store.createContext('production', { endpoint: 'https://api.example.com', targets: { admin: { endpoint: 'https://admin.example.com' } } });
      expect(store.getCredentials(name)).toBeNull();
      expect(store.removeCredentials(name)).toBe(false);
      expect(store.getVar(name, 'production')).toBeNull();
      expect(store.deleteVar(name, 'production')).toBe(false);
      expect(store.getTargetEndpoint(name, 'production')).toBe('https://api.example.com');
      store.setCredentials(name, { token: 't' });
      store.setVar(name, 'v', 'production');

      const reopened = createStore();
      expect(reopened.getCredentials(name)).toMatchObject({ token: 't' });
      expect(reopened.getVar(name, 'production')).toBe('v');
      expect(Object.entries(reopened.listVars('production'))).toEqual([[name, 'v']]);
      expect(reopened.removeCredentials(name)).toBe(true);
      expect(reopened.getCredentials(name)).toBeNull();
    });
  });

  describe('directory modes', () => {
    const posix = process.platform !== 'win32';
    const mode = (dir: string) => fs.statSync(dir).mode & 0o777;
    const owned = () => {
      const dirs = appstash('testapp', { baseDir: tempBase });
      return [dirs.root, dirs.config, dirs.cache, dirs.data, dirs.logs, path.join(dirs.config, 'contexts'), path.join(dirs.config, 'vars')];
    };

    (posix ? it : it.skip)('creates every directory it owns with mode 0700', () => {
      const store = createStore();
      store.createContext('production', { endpoint: 'https://api.example.com' });
      store.setVar('k', 'v', 'production');
      expect(owned().map(mode)).toEqual(owned().map(() => 0o700));
    });

    (posix ? it : it.skip)('tightens the directories it owns when it opens, and never the base directory it was given', () => {
      fs.chmodSync(tempBase, 0o755);
      for (const dir of owned()) {
        fs.mkdirSync(dir, { recursive: true });
        fs.chmodSync(dir, 0o755);
      }
      createStore();
      expect(owned().map(mode)).toEqual(owned().map(() => 0o700));
      expect(mode(tempBase)).toBe(0o755);
    });

    (posix ? it : it.skip)('does not chmod a symlink target or directories under it', () => {
      const dirs = appstash('testapp', { baseDir: tempBase });
      const target = path.join(tempBase, 'elsewhere');
      const contexts = path.join(target, 'contexts');
      fs.mkdirSync(contexts, { recursive: true });
      fs.chmodSync(target, 0o755);
      fs.chmodSync(contexts, 0o755);
      fs.mkdirSync(dirs.root);
      fs.symlinkSync(target, dirs.config);

      createStore();

      expect(mode(target)).toBe(0o755);
      expect(mode(contexts)).toBe(0o755);
    });
  });
});
