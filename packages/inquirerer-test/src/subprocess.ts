import { ChildProcess, spawn, SpawnOptions } from 'child_process';

/**
 * Result of running a CLI subprocess.
 */
export interface RunCliResult {
  /** Captured stdout (utf-8 decoded). */
  stdout: string;
  /** Captured stderr (utf-8 decoded). */
  stderr: string;
  /** Exit code, or `null` if the process was killed by a signal. */
  exitCode: number | null;
  /** Signal that terminated the process, if any. */
  signal: NodeJS.Signals | null;
  /** True iff the process was killed because it exceeded `options.timeout`. */
  timedOut: boolean;
  /** The command that was executed (binary + args). */
  command: string;
}

/**
 * An error thrown when a CLI subprocess exits with a non-zero status, times out,
 * or fails to spawn. The error retains the full {@link RunCliResult} so test
 * assertions can inspect captured output.
 */
export class RunCliError extends Error {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly timedOut: boolean;
  readonly command: string;

  constructor(message: string, result: RunCliResult) {
    super(message);
    this.name = 'RunCliError';
    this.stdout = result.stdout;
    this.stderr = result.stderr;
    this.exitCode = result.exitCode;
    this.signal = result.signal;
    this.timedOut = result.timedOut;
    this.command = result.command;
  }
}

/**
 * Options for {@link runCli}.
 */
export interface RunCliOptions {
  /** Working directory for the child process. */
  cwd?: string;
  /**
   * Environment variables for the child. If omitted, inherits from the parent.
   * If provided, replaces the inherited environment entirely. To extend the
   * parent's env, spread `process.env` yourself (and remember to clear
   * Jest-specific vars like `NODE_OPTIONS` if launching `tsx` / `ts-node`).
   */
  env?: NodeJS.ProcessEnv;
  /** Maximum time (ms) the subprocess may run before being killed. Default: 30_000. */
  timeout?: number;
  /** Signal used to kill the child on timeout. Default: `'SIGKILL'`. */
  killSignal?: NodeJS.Signals;
  /** Optional string to write to the child's stdin before closing it. */
  stdin?: string;
  /**
   * If `true` (default), reject with {@link RunCliError} on non-zero exit,
   * timeout, or spawn error. If `false`, resolve with the {@link RunCliResult}
   * regardless of exit status (only spawn errors and timeouts still reject —
   * but see `reject: 'spawn'` to opt out of that too).
   */
  reject?: boolean;
}

/**
 * Parse a shell-like argument string into an argv array, respecting single
 * and double quoted segments. No shell features (globbing, variable
 * expansion, escapes) — just whitespace splitting with quote awareness.
 *
 * @example
 *   parseArgString(`search "hello world" --json`)
 *   // → ['search', 'hello world', '--json']
 */
export function parseArgString(args: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  for (const ch of args) {
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (/\s/.test(ch)) {
      if (current) {
        result.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) result.push(current);
  return result;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Run a CLI binary as a child process and capture its stdout/stderr. Designed
 * for end-to-end CLI tests where you want to exercise the actual built
 * executable rather than the in-process `Inquirerer` class.
 *
 * Defaults match common Jest expectations: rejects on non-zero exit or
 * timeout (with the captured streams attached to the error), inherits the
 * parent environment unless `options.env` is provided, and uses a 30s
 * timeout. Set `reject: false` to inspect failure cases without `try/catch`.
 *
 * @example In-line args
 * ```ts
 * import { runCli } from '@inquirerer/test';
 *
 * const { stdout } = await runCli('node', [CLI_ENTRY, 'search', 'hello world']);
 * expect(stdout).toContain('1 result');
 * ```
 *
 * @example Shell-string args via {@link parseArgString}
 * ```ts
 * const { stdout } = await runCli('node', parseArgString(`${CLI_ENTRY} search "hello world" --json`));
 * ```
 *
 * @example Inspecting failures
 * ```ts
 * const result = await runCli(BIN, ['bad-command'], { reject: false });
 * expect(result.exitCode).toBe(1);
 * expect(result.stderr).toContain('Unknown command');
 * ```
 *
 * @example Custom environment (e.g. running `tsx` inside Jest)
 * ```ts
 * await runCli(TSX_BIN, [CLI_ENTRY, 'init'], {
 *   cwd: REPO_ROOT,
 *   env: {
 *     ...process.env,
 *     HOME: testHome,
 *     // Clear Jest-inherited NODE_OPTIONS that may conflict with tsx
 *     NODE_OPTIONS: '',
 *   },
 *   timeout: 120_000,
 * });
 * ```
 */
export function runCli(
  bin: string,
  args: string[],
  options: RunCliOptions = {}
): Promise<RunCliResult> {
  const {
    cwd,
    env,
    timeout = DEFAULT_TIMEOUT_MS,
    killSignal = 'SIGKILL',
    stdin,
    reject: shouldReject = true,
  } = options;

  const command = [bin, ...args].join(' ');

  return new Promise<RunCliResult>((resolve, reject) => {
    const spawnOptions: SpawnOptions = {
      stdio: ['pipe', 'pipe', 'pipe'],
    };
    if (cwd !== undefined) spawnOptions.cwd = cwd;
    if (env !== undefined) spawnOptions.env = env;

    let child: ChildProcess;
    try {
      child = spawn(bin, args, spawnOptions);
    } catch (err) {
      reject(err);
      return;
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr?.on('data', (chunk: string) => { stderr += chunk; });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill(killSignal);
    }, timeout);
    // Don't keep the event loop alive just for this timer.
    timer.unref?.();

    if (stdin !== undefined && child.stdin) {
      child.stdin.end(stdin);
    } else if (child.stdin) {
      child.stdin.end();
    }

    const finish = (result: RunCliResult, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    };

    child.on('error', (err) => {
      finish(
        {
          stdout,
          stderr,
          exitCode: null,
          signal: null,
          timedOut,
          command,
        },
        err
      );
    });

    child.on('close', (code, signal) => {
      const result: RunCliResult = {
        stdout,
        stderr,
        exitCode: code,
        signal,
        timedOut,
        command,
      };

      if (timedOut) {
        finish(
          result,
          new RunCliError(
            `Command "${command}" timed out after ${timeout}ms`,
            result
          )
        );
        return;
      }

      if (shouldReject && code !== 0) {
        finish(
          result,
          new RunCliError(
            `Command "${command}" exited with code ${code}${signal ? ` (signal ${signal})` : ''}\nstdout: ${stdout}\nstderr: ${stderr}`,
            result
          )
        );
        return;
      }

      finish(result);
    });
  });
}
