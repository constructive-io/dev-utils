import { formatDuration, parseDuration } from '../src';

describe('parseDuration', () => {
  it('reads unit suffixes as minutes', () => {
    expect(parseDuration('90m')).toBe(90);
    expect(parseDuration('36h')).toBe(2160);
    expect(parseDuration('14d')).toBe(20160);
    expect(parseDuration('2w')).toBe(20160);
  });

  it('treats a bare number as minutes, which is what pnpm stores', () => {
    expect(parseDuration('20160')).toBe(20160);
    expect(parseDuration(20160)).toBe(20160);
  });

  it('accepts whitespace and mixed case', () => {
    expect(parseDuration(' 14 D ')).toBe(20160);
  });

  it('rejects unparseable input rather than guessing', () => {
    expect(() => parseDuration('soon')).toThrow(/Invalid duration/);
    expect(() => parseDuration('14 days')).toThrow(/Invalid duration/);
    expect(() => parseDuration(-1)).toThrow(/Invalid duration/);
  });
});

describe('formatDuration', () => {
  it('picks the largest exact unit', () => {
    expect(formatDuration(20160)).toBe('2w');
    expect(formatDuration(4320)).toBe('3d');
    expect(formatDuration(90)).toBe('90m');
    expect(formatDuration(0)).toBe('0');
  });

  it('round-trips through parseDuration', () => {
    for (const value of ['14d', '36h', '90m', '3w']) {
      expect(parseDuration(formatDuration(parseDuration(value)))).toBe(parseDuration(value));
    }
  });
});
