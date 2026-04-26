import { parseArgString, runCli, RunCliError } from '../src/subprocess';

describe('parseArgString', () => {
  it('splits unquoted args on whitespace', () => {
    expect(parseArgString('search hello world')).toEqual([
      'search',
      'hello',
      'world',
    ]);
  });

  it('respects double-quoted segments', () => {
    expect(parseArgString('search "hello world" --json')).toEqual([
      'search',
      'hello world',
      '--json',
    ]);
  });

  it('respects single-quoted segments', () => {
    expect(parseArgString("ask 'what is going on' --verbose")).toEqual([
      'ask',
      'what is going on',
      '--verbose',
    ]);
  });

  it('collapses runs of whitespace', () => {
    expect(parseArgString('  a   b\tc ')).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array for an empty / whitespace-only string', () => {
    expect(parseArgString('')).toEqual([]);
    expect(parseArgString('   \t  ')).toEqual([]);
  });
});

describe('runCli', () => {
  const node = process.execPath;

  it('captures stdout and stderr from a successful exit', async () => {
    const { stdout, stderr, exitCode, signal, timedOut } = await runCli(node, [
      '-e',
      'process.stdout.write("hello\\n"); process.stderr.write("warn\\n");',
    ]);

    expect(stdout).toBe('hello\n');
    expect(stderr).toBe('warn\n');
    expect(exitCode).toBe(0);
    expect(signal).toBeNull();
    expect(timedOut).toBe(false);
  });

  it('rejects with RunCliError on non-zero exit by default', async () => {
    await expect(
      runCli(node, ['-e', 'process.stderr.write("boom"); process.exit(2);'])
    ).rejects.toMatchObject({
      name: 'RunCliError',
      exitCode: 2,
      stderr: 'boom',
    });
  });

  it('attaches captured streams to the rejection error', async () => {
    let caught: RunCliError | undefined;
    try {
      await runCli(node, [
        '-e',
        'process.stdout.write("partial output\\n"); process.exit(1);',
      ]);
    } catch (err) {
      caught = err as RunCliError;
    }
    expect(caught).toBeInstanceOf(RunCliError);
    expect(caught!.stdout).toBe('partial output\n');
    expect(caught!.exitCode).toBe(1);
  });

  it('with reject:false, resolves on non-zero exit', async () => {
    const result = await runCli(
      node,
      ['-e', 'process.stderr.write("bad"); process.exit(7);'],
      { reject: false }
    );

    expect(result.exitCode).toBe(7);
    expect(result.stderr).toBe('bad');
    expect(result.timedOut).toBe(false);
  });

  it('writes options.stdin to the child', async () => {
    const { stdout } = await runCli(
      node,
      [
        '-e',
        'let d=""; process.stdin.on("data",c=>d+=c); process.stdin.on("end",()=>process.stdout.write(d));',
      ],
      { stdin: 'piped input' }
    );
    expect(stdout).toBe('piped input');
  });

  it('honours options.cwd', async () => {
    const { stdout } = await runCli(node, [
      '-e',
      'process.stdout.write(process.cwd());',
    ], { cwd: '/' });
    expect(stdout).toBe('/');
  });

  it('honours options.env (replaces parent env)', async () => {
    const { stdout } = await runCli(
      node,
      ['-e', 'process.stdout.write(process.env.RUN_CLI_TEST_VAR ?? "missing");'],
      { env: { ...process.env, RUN_CLI_TEST_VAR: 'visible' } }
    );
    expect(stdout).toBe('visible');
  });

  it('rejects with timedOut=true when the subprocess exceeds the timeout', async () => {
    let caught: RunCliError | undefined;
    try {
      await runCli(node, ['-e', 'setTimeout(() => {}, 60000);'], {
        timeout: 100,
      });
    } catch (err) {
      caught = err as RunCliError;
    }
    expect(caught).toBeInstanceOf(RunCliError);
    expect(caught!.timedOut).toBe(true);
    expect(caught!.message).toMatch(/timed out after 100ms/);
  });

  it('rejects on spawn error (binary not found)', async () => {
    await expect(
      runCli('/this/binary/does/not/exist', ['arg'])
    ).rejects.toThrow();
  });
});
