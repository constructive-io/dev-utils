import http from 'node:http';

import { createFetch, isLocalhostSubdomain } from '../src';

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

  it('returns the same instance on repeated calls', () => {
    const a = createFetch();
    const b = createFetch();
    expect(a).toBe(b);
  });
});

describe('fetch with *.localhost', () => {
  let server: http.Server;
  let port: number;

  beforeAll((done) => {
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          host: req.headers.host,
          method: req.method,
          url: req.url,
          body: body || undefined,
        }));
      });
    });
    server.listen(0, 'localhost', () => {
      port = (server.address() as { port: number }).port;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('rewrites *.localhost URL to localhost and preserves Host header', async () => {
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

  it('preserves plain localhost requests as-is', async () => {
    const fetch = createFetch();
    const res = await fetch(`http://localhost:${port}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ hello }' }),
    });

    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.host).toBe(`localhost:${port}`);
  });

  it('sends correct content-type header', async () => {
    const fetch = createFetch();
    const res = await fetch(`http://admin.localhost:${port}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: '{ test }' }),
    });

    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.host).toBe(`admin.localhost:${port}`);
  });
});
