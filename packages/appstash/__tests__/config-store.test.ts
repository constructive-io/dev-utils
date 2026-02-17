import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createConfigStore } from '../src';

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
});
