import { PassThrough, Writable } from 'stream';

import { CancelReason, Inquirerer } from '../src';
import { Question } from '../src/question';

/** A fake terminal: readline sees a TTY on both ends, so it runs in terminal mode as it does for a person. */
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
  return { input, output, raw: () => raw };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const STILL_WAITING = 'still waiting';
/** The prompt's answer or its error, or STILL_WAITING when it has neither after 200 ms. */
const outcomeOf = (answers: Promise<unknown>) =>
  Promise.race([answers.catch((error: unknown) => error), new Promise((resolve) => setTimeout(() => resolve(STILL_WAITING), 200))]);

async function type(input: PassThrough, keys: string[]): Promise<void> {
  for (const key of keys) {
    input.write(key);
    await tick();
  }
}

class Cancelled extends Error {
  constructor(readonly reason: CancelReason) {
    super(`cancelled: ${reason}`);
  }
}

const list: Question = { type: 'list', name: 'pick', message: 'Pick one', options: ['a', 'b', 'c'] };
const text: Question = { type: 'text', name: 'name', message: 'Name' };

describe('the clearScreen option', () => {
  it('false writes each prompt below the screen, and a redraw erases only the lines the prompt drew', async () => {
    const term = terminal();
    term.output.write('earlier output\n');
    const prompter = new Inquirerer({ input: term.input, output: term.output, clearScreen: false });
    const answers = prompter.prompt({}, [list]);
    await tick();
    await type(term.input, ['\u001b[B', '\u001b[B', '\r']);
    expect(await answers).toEqual({ pick: 'c' });
    prompter.close();

    const raw = term.raw();
    expect(raw).not.toContain('\x1bc');
    expect(raw.startsWith('earlier output\n')).toBe(true);
    const parts = raw.slice('earlier output\n'.length).split(/\x1b\[(\d+)A\r\x1b\[J/);
    const erased = parts.filter((_, i) => i % 2 === 1).map(Number);
    const drawn = parts.filter((_, i) => i % 2 === 0).slice(0, -1).map((part) => part.split('\n').length - 1);
    expect(erased.length).toBeGreaterThanOrEqual(2);
    expect(erased).toEqual(drawn);
  });
});

describe('the onCancel option', () => {
  let exit: jest.SpyInstance;
  let kill: jest.SpyInstance;

  beforeEach(() => {
    exit = jest.spyOn(process, 'exit').mockImplementation((): never => undefined as never);
    kill = jest.spyOn(process, 'kill').mockImplementation(() => true);
  });

  afterEach(() => {
    exit.mockRestore();
    kill.mockRestore();
  });

  it.each<[string, Question[], string[], CancelReason]>([
    ['Ctrl-C at a list prompt', [list], ['\x03'], 'interrupt'],
    ['Ctrl-D at a list prompt', [list], ['\x04'], 'end-of-input'],
    ['Ctrl-C at a text prompt after a list prompt', [list, text], ['\r', '\x03'], 'interrupt'],
    ['Ctrl-D at a text prompt after a list prompt', [list, text], ['\r', '\x04'], 'end-of-input']
  ])('%s rejects the prompt with the onCancel error', async (_case, questions, keys, reason) => {
    const term = terminal();
    const prompter = new Inquirerer({ input: term.input, output: term.output, onCancel: (why) => new Cancelled(why) });
    const outcome = outcomeOf(prompter.prompt({}, questions));
    await tick();
    await type(term.input, keys);
    expect(await outcome).toEqual(new Cancelled(reason));
    prompter.close();
    expect(exit).not.toHaveBeenCalled();
    expect(kill).not.toHaveBeenCalled();
  });

  it('rejects a waiting prompt with end-of-input when the input stream ends', async () => {
    const term = terminal();
    const prompter = new Inquirerer({ input: term.input, output: term.output, onCancel: (why) => new Cancelled(why) });
    const outcome = outcomeOf(prompter.prompt({}, [text]));
    await tick();
    term.input.end();
    expect(await outcome).toEqual(new Cancelled('end-of-input'));
    prompter.close();
  });

  it('sends SIGINT to the process for Ctrl-C while no prompt is pending', async () => {
    const term = terminal();
    const prompter = new Inquirerer({ input: term.input, output: term.output, onCancel: (why) => new Cancelled(why) });
    const answers = prompter.prompt({}, [list]);
    await tick();
    await type(term.input, ['\r']);
    expect(await answers).toEqual({ pick: 'a' });
    await type(term.input, ['\x03']);
    prompter.close();
    expect(kill).toHaveBeenCalledWith(process.pid, 'SIGINT');
    expect(exit).not.toHaveBeenCalled();
  });
});
