import { merge, mergeNullable } from '../src';
import type { YamlNode } from '../src';

describe('merge', () => {
  it('merges flat objects', () => {
    const base = { a: 'one', b: 'two' };
    const overrides = { b: 'THREE', c: 'four' };
    const result = merge(base, overrides);
    expect(result).toEqual({ a: 'one', b: 'THREE', c: 'four' });
  });

  it('deep-merges nested objects', () => {
    const base = { spec: { replicas: 1, image: 'nginx' } };
    const overrides = { spec: { replicas: 3 } };
    const result = merge(base, overrides);
    expect(result).toEqual({ spec: { replicas: 3, image: 'nginx' } });
  });

  it('skips null values by default (inherit from base)', () => {
    const base = { name: 'app', image: 'nginx:1.0' };
    const result = merge(base, { image: null } as Record<string, YamlNode>);
    expect(result).toEqual({ name: 'app', image: 'nginx:1.0' });
  });

  it('skips undefined values', () => {
    const base = { name: 'app', image: 'nginx:1.0' };
    const result = merge(base, { image: undefined } as Record<string, YamlNode>);
    expect(result).toEqual({ name: 'app', image: 'nginx:1.0' });
  });

  it('removes keys when nullRemoves is true', () => {
    const base = { name: 'app', image: 'nginx:1.0' };
    const result = merge(base, { image: null } as Record<string, YamlNode>, { nullRemoves: true });
    expect(result).toEqual({ name: 'app' });
  });

  it('replaces arrays (does not concatenate)', () => {
    const base = { ports: [80, 443] };
    const overrides = { ports: [8080] };
    const result = merge(base, overrides);
    expect(result).toEqual({ ports: [8080] });
  });

  it('does not mutate the base object', () => {
    const base = { a: 'one', nested: { b: 'two' } };
    const copy = JSON.parse(JSON.stringify(base));
    merge(base, { nested: { b: 'THREE' } });
    expect(base).toEqual(copy);
  });

  it('handles empty overrides', () => {
    const base = { a: 1, b: 2 };
    const result = merge(base, {});
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('handles empty base', () => {
    const result = merge({}, { a: 1 });
    expect(result).toEqual({ a: 1 });
  });

  it('deep-merges multiple levels', () => {
    const base = { a: { b: { c: 1, d: 2 } } };
    const overrides = { a: { b: { c: 99 } } };
    const result = merge(base, overrides);
    expect(result).toEqual({ a: { b: { c: 99, d: 2 } } });
  });
});

describe('mergeNullable', () => {
  it('merges non-null values', () => {
    const base = { name: 'app', replicas: 1 };
    const overrides = { replicas: 3 };
    const result = mergeNullable(base, overrides);
    expect(result).toEqual({ name: 'app', replicas: 3 });
  });

  it('skips null values (inherit from base)', () => {
    const base = { name: 'app', image: 'nginx:1.0', replicas: 1 };
    const overrides: Partial<typeof base> = { image: null as unknown as string, replicas: 5 };
    const result = mergeNullable(base, overrides);
    expect(result).toEqual({ name: 'app', image: 'nginx:1.0', replicas: 5 });
  });

  it('skips undefined values', () => {
    const base = { name: 'app', replicas: 1 };
    const overrides: Partial<typeof base> = { replicas: undefined };
    const result = mergeNullable(base, overrides);
    expect(result).toEqual({ name: 'app', replicas: 1 });
  });

  it('does not mutate the base object', () => {
    const base = { a: 'one', b: 'two' };
    const copy = { ...base };
    mergeNullable(base, { b: 'THREE' });
    expect(base).toEqual(copy);
  });
});
