import { stripAnsi } from 'clean-ansi';
import { PassThrough, Writable } from 'stream';

import { Inquirerer } from '../src';

/** A fake terminal: readline sees a TTY on both ends, so it runs in terminal mode and echoes what it reads. */
function terminal() {
  const input = new PassThrough();
  Object.assign(input, { isTTY: true, setRawMode: () => input });
  let raw = '';
  const output = new Writable({
    write(chunk, _encoding, callback) {
      raw += chunk.toString();
      callback();
    }
  });
  Object.assign(output, { isTTY: true, columns: 80, rows: 24 });
  return { input, output, raw: () => raw, text: () => stripAnsi(raw) };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

async function type(input: PassThrough, keys: string[]): Promise<void> {
  for (const key of keys) {
    input.write(key);
    await tick();
  }
}

describe('the password prompt', () => {
  it('never writes the typed characters, keeps every code point, and handles backspace and paste', async () => {
    const term = terminal();
    const prompter = new Inquirerer({ input: term.input, output: term.output });
    const answers = prompter.prompt({}, [{ type: 'password', name: 'pw', message: 'Enter it', required: true }]);
    await tick();
    await type(term.input, ['q', 'ä', '€', '9', '😀', '\x7f', 'Ω', 'zz42', '\r']);
    expect(await answers).toEqual({ pw: 'qä€9Ωzz42' });
    prompter.close();

    const shown = term.text();
    for (const char of ['q', 'ä', '€', '9', '😀', 'Ω', 'z', '4', '2']) expect(shown).not.toContain(char);
    expect(shown).toContain(`> ${'*'.repeat(9)}`);
    // With the default clearScreen, the screen is reset before the prompt draws, as for every other prompt.
    expect(term.raw().split('\x1bc').length - 1).toBe(1);
    expect(term.raw().indexOf('\x1bc')).toBeLessThan(term.raw().indexOf('Enter it'));
  });

  it('with onCancel set, returns the secret, and the next prompt still ends as cancelled on Ctrl-D', async () => {
    const term = terminal();
    const prompter = new Inquirerer({ input: term.input, output: term.output, onCancel: (reason) => new Error(reason) });
    const outcomeOf = (answers: Promise<unknown>) =>
      Promise.race([answers.catch((error: unknown) => error), new Promise((resolve) => setTimeout(() => resolve('still waiting'), 200))]);

    const secret = outcomeOf(prompter.prompt({}, [{ type: 'password', name: 'pw', message: 'Enter it', required: true }]));
    await tick();
    await type(term.input, ['s3cret', '\r']);
    expect(await secret).toEqual({ pw: 's3cret' });

    const next = outcomeOf(prompter.prompt({}, [{ type: 'text', name: 'name', message: 'Name' }]));
    await tick();
    await type(term.input, ['\x04']);
    expect(await next).toEqual(new Error('end-of-input'));
    prompter.close();
  });
});
