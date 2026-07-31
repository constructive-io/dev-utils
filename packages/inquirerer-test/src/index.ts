// Key sequences for simulating user input
export type { KeySequence } from './keys';
export { KEY_SEQUENCES } from './keys';

// Test environment setup
export type { InputResponse,TestEnvironment } from './harness';
export { createTestEnvironment,setupTests } from './harness';

// Test fixture for CLI testing
export type { RunCmdResult,TestFixture, TestFixtureOptions } from './fixture';
export { createTestFixture } from './fixture';

// Snapshot utilities
export type { NormalizeOptions } from './snapshot';
export { normalizePackageJsonForSnapshot } from './snapshot';

// Subprocess testing for CLI E2E tests
export type { RunCliOptions, RunCliResult } from './subprocess';
export { parseArgString, runCli, RunCliError } from './subprocess';

// ANSI utilities (re-exported from clean-ansi for convenience)
export { cleanAnsi } from 'clean-ansi';
