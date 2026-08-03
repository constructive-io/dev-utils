import { makeMatcher, normalizeExts, withinAny } from '../src/match';

const cwd = '/repo';

describe('makeMatcher', () => {
  it('matches nothing when no patterns are given', () => {
    const match = makeMatcher([], cwd);
    expect(match('/repo/a.sql')).toBe(false);
  });

  it('matches a directory and its whole subtree', () => {
    const match = makeMatcher(['dist/'], cwd);
    expect(match('/repo/dist')).toBe(true);
    expect(match('/repo/dist/a.sql')).toBe(true);
    expect(match('/repo/pkg/dist/deep/a.sql')).toBe(true);
    expect(match('/repo/distinct/a.sql')).toBe(false);
  });

  it('anchors a pattern that starts with a slash', () => {
    const match = makeMatcher(['/sql/'], cwd);
    expect(match('/repo/sql/a.sql')).toBe(true);
    expect(match('/repo/pkg/sql/a.sql')).toBe(false);
  });

  it('keeps * inside a single segment and ** across segments', () => {
    const single = makeMatcher(['pkg/*/deploy'], cwd);
    expect(single('/repo/pkg/one/deploy/a.sql')).toBe(true);
    expect(single('/repo/pkg/one/two/deploy/a.sql')).toBe(false);

    const deep = makeMatcher(['**/generated/**'], cwd);
    expect(deep('/repo/a/b/generated/c.sql')).toBe(true);
    expect(deep('/repo/generated/c.sql')).toBe(true);
  });

  it('matches an extension glob and a single-character glob', () => {
    expect(makeMatcher(['*.sql'], cwd)('/repo/a/b/c.sql')).toBe(true);
    expect(makeMatcher(['v?.sql'], cwd)('/repo/v1.sql')).toBe(true);
    expect(makeMatcher(['v?.sql'], cwd)('/repo/v12.sql')).toBe(false);
  });

  it('matches the pgpm bundle artifacts and not their siblings', () => {
    const match = makeMatcher(['**/sql/*--*.sql'], cwd);
    expect(match('/repo/application/app/sql/app--0.0.1.sql')).toBe(true);
    expect(match('/repo/sql/app--0.0.1.sql')).toBe(true);
    expect(match('/repo/application/app/sql/helper.sql')).toBe(false);
  });

  it('treats regex metacharacters in a pattern literally', () => {
    const match = makeMatcher(['a+b/'], cwd);
    expect(match('/repo/a+b/c.sql')).toBe(true);
    expect(match('/repo/aab/c.sql')).toBe(false);
  });
});

describe('withinAny', () => {
  it('accepts everything when no directories are given', () => {
    expect(withinAny('/repo/a.sql', [], cwd)).toBe(true);
  });

  it('accepts the directory itself and its descendants only', () => {
    expect(withinAny('/repo/pkg/a.sql', ['pkg'], cwd)).toBe(true);
    expect(withinAny('/repo/pkg', ['pkg'], cwd)).toBe(true);
    // A sibling whose name merely starts with the same characters is outside.
    expect(withinAny('/repo/pkg-other/a.sql', ['pkg'], cwd)).toBe(false);
  });
});

describe('normalizeExts', () => {
  it('normalizes a string, a list, commas and a missing dot', () => {
    expect(normalizeExts('sql')).toEqual(['.sql']);
    expect(normalizeExts('.SQL')).toEqual(['.sql']);
    expect(normalizeExts(['.ts,tsx', ' .mts '])).toEqual(['.ts', '.tsx', '.mts']);
    expect(normalizeExts(undefined)).toEqual([]);
  });
});
