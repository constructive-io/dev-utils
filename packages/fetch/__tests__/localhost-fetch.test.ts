import http from 'node:http';
import { AddressInfo } from 'node:net';

import { createFetch, isLocalhostSubdomain } from '../src';

type ServerInfo = { server: http.Server; port: number };

const openServers: http.Server[] = [];

function startServer(host: string): Promise<ServerInfo> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            host: req.headers.host,
            method: req.method,
            url: req.url,
            body: body || undefined,
          }),
        );
      });
    });
    server.on('error', reject);
    server.listen(0, host, () => {
      openServers.push(server);
      resolve({ server, port: (server.address() as AddressInfo).port });
    });
  });
}

/** Whether the host can actually bind an IPv6 loopback listener. */
async function ipv6Available(): Promise<boolean> {
  try {
    const { server } = await startServer('::1');
    server.close();
    return true;
  } catch {
    return false;
  }
}

afterAll(() => {
  for (const server of openServers) server.close();
});

describe('isLocalhostSubdomain', () => {
  it('returns true for *.localhost', () => {
    expect(isLocalhostSubdomain('auth.localhost')).toBe(true);
    expect(isLocalhostSubdomain('api.localhost')).toBe(true);
    expect(isLocalhostSubdomain('deep.sub.localhost')).toBe(true);
  });

  it('returns false for bare localhost', () => {
    expect(isLocalhostSubdomain('localhost')).toBe(false);
  });

  it('returns false for non-localhost', () => {
    expect(isLocalhostSubdomain('example.com')).toBe(false);
    expect(isLocalhostSubdomain('auth.example.com')).toBe(false);
  });
});

describe('createFetch', () => {
  it('returns a function', () => {
    const fetch = createFetch();
    expect(typeof fetch).toBe('function');
  });

  it('returns the same instance on repeated default calls', () => {
    expect(createFetch()).toBe(createFetch());
    expect(createFetch()).toBe(createFetch({}));
    expect(createFetch()).toBe(createFetch({ loopback: '127.0.0.1' }));
  });

  it('builds a fresh instance for non-default loopback', () => {
    expect(createFetch({ loopback: false })).not.toBe(createFetch());
    expect(createFetch({ loopback: '::1' })).not.toBe(createFetch());
  });
});

describe('fetch with *.localhost (default IPv4 loopback)', () => {
  let port: number;

  beforeAll(async () => {
    // IPv4-only listener, mimicking kind / Docker's IPv4 port publishing.
    ({ port } = await startServer('127.0.0.1'));
  });

  it('reaches an IPv4-only ingress and preserves the Host header', async () => {
    const fetch = createFetch();
    const res = await fetch(`http://auth.localhost:${port}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ hello }' }),
    });

    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.host).toBe(`auth.localhost:${port}`);
    expect(json.method).toBe('POST');
    expect(json.url).toBe('/graphql');
    expect(JSON.parse(json.body)).toEqual({ query: '{ hello }' });
  });

  it('sends caller headers alongside the preserved Host header', async () => {
    const fetch = createFetch();
    const res = await fetch(`http://admin.localhost:${port}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query: '{ test }' }),
    });

    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.host).toBe(`admin.localhost:${port}`);
  });

  it('preserves plain localhost requests as-is (delegates to global fetch)', async () => {
    // Bare localhost is not a *.localhost subdomain, so it is handled by
    // global fetch, which resolves localhost via DNS. Bind on both families
    // so the delegated request connects regardless of resolution order.
    const { port: dualPort } = await startServer('localhost');
    const fetch = createFetch();
    const res = await fetch(`http://localhost:${dualPort}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ hello }' }),
    });

    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.host).toBe(`localhost:${dualPort}`);
  });
});

describe('fetch with *.localhost (loopback option)', () => {
  it('loopback: false falls back to DNS resolution of localhost', async () => {
    const { port } = await startServer('localhost');
    const fetch = createFetch({ loopback: false });
    const res = await fetch(`http://api.localhost:${port}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ hello }' }),
    });

    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.host).toBe(`api.localhost:${port}`);
  });

  it('loopback: "::1" reaches an IPv6-only ingress', async () => {
    if (!(await ipv6Available())) {
      console.warn('SKIP: IPv6 loopback unavailable in this environment');
      return;
    }
    const { port } = await startServer('::1');
    const fetch = createFetch({ loopback: '::1' });
    const res = await fetch(`http://api.localhost:${port}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ hello }' }),
    });

    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.host).toBe(`api.localhost:${port}`);
  });
});
