import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { createConfigStore, SecretCodec } from '../src';

describe('createConfigStore — shared identity, secrets and durability', () => {
  let tempBase: string;

  beforeEach(() => {
    tempBase = fs.mkdtempSync(path.join(os.tmpdir(), 'appstash-shared-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempBase, { recursive: true, force: true });
  });

  const rot13: SecretCodec = {
    name: 'rot13',
    encode: (s: string) => s.replace(/[a-z]/gi, (c: string) =>
      String.fromCharCode(((c.charCodeAt(0) - (c < 'a' ? 65 : 97) + 13) % 26) + (c < 'a' ? 65 : 97))
    ),
    decode: (s: string) => rot13.encode(s)
  };

  const credentialsFile = (stash: string) =>
    path.join(tempBase, `.${stash}`, 'config', 'credentials.json');

  describe('stashName', () => {
    it('lets two differently-named tools share one signed-in state', () => {
      const csdk = createConfigStore('csdk', { baseDir: tempBase, stashName: 'constructive' });
      csdk.createContext('localnet', { endpoint: 'http://api.localhost:3000/graphql' });
      csdk.setCurrentContext('localnet');
      csdk.setCredentials('localnet', { token: 'tok', email: 'dan@example.com' });

      const agent = createConfigStore('agent', { baseDir: tempBase, stashName: 'constructive' });

      expect(agent.getCurrentContext()?.name).toBe('localnet');
      expect(agent.getCredentials('localnet')).toMatchObject({ token: 'tok', email: 'dan@example.com' });
      expect(fs.existsSync(credentialsFile('constructive'))).toBe(true);
    });

    it('keeps tools isolated when no stashName is given', () => {
      const a = createConfigStore('toola', { baseDir: tempBase });
      a.createContext('dev', { endpoint: 'http://a' });
      a.setCurrentContext('dev');

      const b = createConfigStore('toolb', { baseDir: tempBase });
      expect(b.getCurrentContext()).toBeNull();
    });

    it('still uses toolName for env-var prefixes and error text', () => {
      const store = createConfigStore('csdk', { baseDir: tempBase, stashName: 'constructive' });
      process.env.CSDK_API_ENDPOINT = 'http://from-env/graphql';
      try {
        expect(store.getClientConfig('api').endpoint).toBe('http://from-env/graphql');
      } finally {
        delete process.env.CSDK_API_ENDPOINT;
      }

      const bare = createConfigStore('csdk', { baseDir: tempBase, stashName: 'constructive' });
      expect(() => bare.getClientConfig('api')).toThrow(/csdk context create/);
    });
  });

  describe('session identity fields', () => {
    it('round-trips the identity carried alongside the token', () => {
      const store = createConfigStore('testapp', { baseDir: tempBase });
      const signedInAt = Date.now();
      store.setCredentials('prod', {
        token: 'access',
        refreshToken: 'refresh',
        userId: 'user-1',
        email: 'dan@example.com',
        apiKey: 'cnc_live_sk_abc',
        keyId: 'key-1',
        apiKeyExpiresAt: '2027-01-01T00:00:00.000Z',
        signedInAt
      });

      expect(store.getCredentials('prod')).toEqual({
        token: 'access',
        refreshToken: 'refresh',
        userId: 'user-1',
        email: 'dan@example.com',
        apiKey: 'cnc_live_sk_abc',
        keyId: 'key-1',
        apiKeyExpiresAt: '2027-01-01T00:00:00.000Z',
        signedInAt
      });
    });
  });

  describe('secret codec', () => {
    it('encodes secret fields at rest and decodes them on read', () => {
      const store = createConfigStore('testapp', { baseDir: tempBase, codec: rot13 });
      store.setCredentials('prod', {
        token: 'secret',
        refreshToken: 'refresh',
        apiKey: 'apikey',
        email: 'dan@example.com'
      });

      const onDisk = JSON.parse(fs.readFileSync(credentialsFile('testapp'), 'utf8'));
      expect(onDisk.codec).toBe('rot13');
      expect(onDisk.tokens.prod.token).toBe(rot13.encode('secret'));
      expect(onDisk.tokens.prod.apiKey).toBe(rot13.encode('apikey'));
      // Non-secret fields stay readable.
      expect(onDisk.tokens.prod.email).toBe('dan@example.com');

      expect(store.getCredentials('prod')).toMatchObject({
        token: 'secret',
        refreshToken: 'refresh',
        apiKey: 'apikey'
      });
    });

    it('records plaintext when no codec is configured', () => {
      const store = createConfigStore('testapp', { baseDir: tempBase });
      store.setCredentials('prod', { token: 'secret' });

      const onDisk = JSON.parse(fs.readFileSync(credentialsFile('testapp'), 'utf8'));
      expect(onDisk.codec).toBe('plaintext');
      expect(onDisk.tokens.prod.token).toBe('secret');
    });

    it('refuses to read credentials written by a different codec', () => {
      const plain = createConfigStore('testapp', { baseDir: tempBase });
      plain.setCredentials('prod', { token: 'secret' });

      const encrypted = createConfigStore('testapp', { baseDir: tempBase, codec: rot13 });
      expect(() => encrypted.getCredentials('prod')).toThrow(/"plaintext" codec.*uses "rot13"/s);
    });

    it('accepts an empty store regardless of codec', () => {
      const encrypted = createConfigStore('testapp', { baseDir: tempBase, codec: rot13 });
      expect(encrypted.getCredentials('prod')).toBeNull();
      expect(encrypted.hasValidCredentials('prod')).toBe(false);
    });
  });

  describe('durability and permissions', () => {
    it('writes credentials 0600 and leaves no temp files behind', () => {
      const store = createConfigStore('testapp', { baseDir: tempBase });
      store.setCredentials('prod', { token: 'secret' });

      const file = credentialsFile('testapp');
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
      const leftovers = fs.readdirSync(path.dirname(file)).filter((f) => f.endsWith('.tmp'));
      expect(leftovers).toEqual([]);
    });

    it('writes context and settings files 0600 too', () => {
      const store = createConfigStore('testapp', { baseDir: tempBase });
      store.createContext('prod', { endpoint: 'http://api' });
      store.setCurrentContext('prod');
      store.setVar('DATABASE_ID', 'db-1', 'prod');

      const configDir = path.join(tempBase, '.testapp', 'config');
      for (const file of [
        path.join(configDir, 'settings.json'),
        path.join(configDir, 'contexts', 'prod.json'),
        path.join(configDir, 'vars', 'prod.json')
      ]) {
        expect(fs.statSync(file).mode & 0o777).toBe(0o600);
      }
    });

    it('throws with the path when a stored file is malformed', () => {
      const store = createConfigStore('testapp', { baseDir: tempBase });
      const file = credentialsFile('testapp');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, '{ this is not json');

      expect(() => store.getCredentials('prod')).toThrow(/Malformed JSON in .*credentials\.json/);
    });

    it('does not silently drop a malformed context when listing', () => {
      const store = createConfigStore('testapp', { baseDir: tempBase });
      store.createContext('good', { endpoint: 'http://api' });
      const contextsDir = path.join(tempBase, '.testapp', 'config', 'contexts');
      fs.writeFileSync(path.join(contextsDir, 'broken.json'), 'nope');

      expect(() => store.listContexts()).toThrow(/Malformed JSON in .*broken\.json/);
    });
  });
});
