import fs from 'fs';
import os from 'os';
import path from 'path';
import { Inquirerer, CLIOptions } from 'inquirerer';
import { ParsedArgs } from 'minimist';
import { createTestEnvironment, TestEnvironment } from './harness';

const { mkdtempSync, rmSync, cpSync } = fs;

/**
 * Configuration options for creating a CLI test fixture.
 */
export interface TestFixtureOptions<TResult = unknown> {
  /**
   * The CLI commands function to execute.
   * Should have signature: (argv, prompter, options) => Promise<TResult>
   */
  commands: (
    argv: Partial<ParsedArgs>,
    prompter: Inquirerer,
    options: CLIOptions
  ) => Promise<TResult>;

  /**
   * Root directory containing test fixtures to copy from.
   * If not provided, no fixtures will be copied.
   */
  fixtureRoot?: string;

  /**
   * Prefix for the temporary directory name.
   * @default 'cli-test-'
   */
  tmpPrefix?: string;

  /**
   * Transform argv before passing to commands.
   * Useful for setting default values (e.g., pgpm's withInitDefaults).
   */
  argvTransform?: (argv: Partial<ParsedArgs>) => Partial<ParsedArgs>;

  /**
   * Default CLI options to merge with test environment options.
   */
  cliOptions?: Partial<CLIOptions> & {
    version?: string;
    minimistOpts?: Record<string, unknown>;
  };
}

/**
 * Result returned from running a CLI command in the test fixture.
 */
export interface RunCmdResult<TResult = unknown> {
  /** The result returned by the commands function */
  result: TResult;
  /** The argv that was passed to commands (after any transforms) */
  argv: Partial<ParsedArgs>;
  /** Captured output lines (ANSI stripped, key sequences humanized) */
  writeResults: string[];
  /** Captured transform stream results */
  transformResults: string[];
}

/**
 * A test fixture for testing inquirerer-based CLI applications.
 */
export interface TestFixture<TResult = unknown> {
  /** The temporary directory created for this fixture */
  readonly tempDir: string;
  /** The directory where fixtures were copied (or tempDir if no fixtures) */
  readonly tempFixtureDir: string;
  /** The test environment with mock streams */
  readonly environment: TestEnvironment;

  /**
   * Get the path to a file within the fixture directory.
   */
  fixturePath(...paths: string[]): string;

  /**
   * Get the path to a file within the fixture directory.
   * Alias for fixturePath for backwards compatibility.
   */
  getFixturePath(...paths: string[]): string;

  /**
   * Run a CLI command with the given argv.
   */
  runCmd(argv: Partial<ParsedArgs>): Promise<RunCmdResult<TResult>>;

  /**
   * Clean up the temporary directory.
   * Call this in afterEach or after your test completes.
   */
  cleanup(): void;
}

/**
 * Creates a test fixture for testing inquirerer-based CLI applications.
 * 
 * The fixture handles:
 * - Creating a temporary directory
 * - Optionally copying fixture files
 * - Setting up mock stdin/stdout streams
 * - Creating an Inquirerer prompter with the mock streams
 * - Running CLI commands with the test environment
 * 
 * @example
 * ```typescript
 * import { createTestFixture } from '@inquirerer/test';
 * import { commands } from '../src/commands';
 * 
 * describe('my CLI', () => {
 *   let fixture: TestFixture;
 * 
 *   beforeEach(() => {
 *     fixture = createTestFixture({
 *       commands,
 *       fixtureRoot: path.resolve(__dirname, '../__fixtures__'),
 *       tmpPrefix: 'my-cli-test-',
 *       cliOptions: { version: '1.0.0' }
 *     });
 *   });
 * 
 *   afterEach(() => {
 *     fixture.cleanup();
 *   });
 * 
 *   it('should run a command', async () => {
 *     const { result, writeResults } = await fixture.runCmd({ _: ['init'] });
 *     expect(writeResults.join('')).toContain('Initialized');
 *   });
 * });
 * ```
 * 
 * @example With fixture files
 * ```typescript
 * // Copy fixtures from __fixtures__/my-project to temp dir
 * const fixture = createTestFixture({
 *   commands,
 *   fixtureRoot: FIXTURES_PATH
 * }, 'my-project');
 * 
 * // Access files in the fixture
 * const configPath = fixture.fixturePath('config.json');
 * ```
 */
export function createTestFixture<TResult = unknown>(
  options: TestFixtureOptions<TResult>,
  ...fixturePath: string[]
): TestFixture<TResult> {
  const {
    commands,
    fixtureRoot,
    tmpPrefix = 'cli-test-',
    argvTransform,
    cliOptions = {}
  } = options;

  // Create temp directory
  const tempDir = mkdtempSync(path.join(os.tmpdir(), tmpPrefix));

  // Copy fixtures if provided
  let tempFixtureDir: string;
  if (fixturePath.length > 0 && fixtureRoot) {
    const originalFixtureDir = path.join(fixtureRoot, ...fixturePath);
    tempFixtureDir = path.join(tempDir, ...fixturePath);
    cpSync(originalFixtureDir, tempFixtureDir, { recursive: true });
  } else {
    tempFixtureDir = tempDir;
  }

  // Create test environment
  const environment = createTestEnvironment();

  const getFixturePath = (...paths: string[]) =>
    path.join(tempFixtureDir, ...paths);

  const fixturePathFn = (...paths: string[]) =>
    path.join(tempFixtureDir, ...paths);

  const cleanup = () => {
    rmSync(tempDir, { recursive: true, force: true });
  };

  const runCmd = async (argv: Partial<ParsedArgs>): Promise<RunCmdResult<TResult>> => {
    const {
      mockInput,
      mockOutput,
      writeResults,
      transformResults
    } = environment;

    // Apply argv transform if provided
    const transformedArgv = argvTransform ? argvTransform(argv) : argv;

    // Create prompter with mock streams
    const prompter = new Inquirerer({
      input: mockInput,
      output: mockOutput,
      noTty: true
    });

    // Merge CLI options
    const mergedOptions: CLIOptions = {
      noTty: true,
      input: mockInput,
      output: mockOutput,
      version: cliOptions.version || '1.0.0',
      minimistOpts: cliOptions.minimistOpts || {},
      ...cliOptions
    };

    // Run commands
    const result = await commands(transformedArgv, prompter, mergedOptions);

    return {
      result,
      argv: transformedArgv,
      writeResults,
      transformResults
    };
  };

  return {
    tempDir,
    tempFixtureDir,
    environment,
    fixturePath: fixturePathFn,
    getFixturePath,
    runCmd,
    cleanup
  };
}
