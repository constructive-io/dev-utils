// Key sequences for simulating user input
export { KEY_SEQUENCES } from './keys';
export type { KeySequence } from './keys';

// Test environment setup
export { setupTests, createTestEnvironment } from './harness';
export type { TestEnvironment, InputResponse } from './harness';

// Test fixture for CLI testing
export { createTestFixture } from './fixture';
export type { TestFixture, TestFixtureOptions, RunCmdResult } from './fixture';

// Snapshot utilities
export { normalizePackageJsonForSnapshot } from './snapshot';
export type { NormalizeOptions } from './snapshot';

// ANSI utilities (re-exported from clean-ansi for convenience)
export { cleanAnsi } from 'clean-ansi';
