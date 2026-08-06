/**
 * Durations, in the unit pnpm speaks.
 *
 * `minimumReleaseAge` is minutes, which nobody wants to write for a multi-day
 * cooldown, so the config takes `2d` and this converts.
 */

import { PolicyError } from './errors';

const UNITS: Record<string, number> = {
  m: 1,
  h: 60,
  d: 60 * 24,
  w: 60 * 24 * 7
};

/** Parse `14d` / `36h` / `90m` / `2w` / `20160` into minutes. */
export function parseDuration(value: string | number): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new PolicyError(`Invalid duration: ${value}`);
    }
    return Math.round(value);
  }

  const trimmed = value.trim();
  const match = /^(\d+(?:\.\d+)?)\s*([mhdw])?$/i.exec(trimmed);
  if (!match) {
    throw new PolicyError(
      `Invalid duration: "${value}". Use a number of minutes or a unit suffix: 90m, 36h, 14d, 2w.`
    );
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? 'm').toLowerCase();
  return Math.round(amount * UNITS[unit]);
}

/** Render minutes back to the shortest exact human form, for comments. */
export function formatDuration(minutes: number): string {
  if (minutes === 0) return '0';
  for (const [unit, size] of [
    ['w', UNITS.w],
    ['d', UNITS.d],
    ['h', UNITS.h]
  ] as Array<[string, number]>) {
    if (minutes % size === 0) return `${minutes / size}${unit}`;
  }
  return `${minutes}m`;
}
