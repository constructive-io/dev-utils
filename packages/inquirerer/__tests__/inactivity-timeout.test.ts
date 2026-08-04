import readline from 'readline';
import { Readable, Writable } from 'stream';

import { Inquirerer } from '../src';

jest.mock('readline');

const timeoutOf = (prompter: Inquirerer): number | undefined =>
  (prompter as unknown as { timeout?: number }).timeout;

describe('default inactivity timeout', () => {
  const output = new Writable({ write(_chunk, _enc, cb) { cb(); } });

  beforeEach(() => {
    readline.createInterface = jest.fn().mockReturnValue({ question: jest.fn(), close: jest.fn() });
  });

  const inputStream = (isTTY: boolean): Readable =>
    Object.assign(new Readable({ read() {} }), { isTTY });

  it('is not armed for a person at a terminal', () => {
    const prompter = new Inquirerer({ input: inputStream(true), output });
    expect(timeoutOf(prompter)).toBeUndefined();
  });

  it('is armed when the prompter expects input from a non-terminal stream', () => {
    const prompter = new Inquirerer({ input: inputStream(false), output });
    expect(timeoutOf(prompter)).toBe(15_000);
  });

  it('honors an explicit timeout at a terminal', () => {
    const prompter = new Inquirerer({ input: inputStream(true), output, timeout: 500 });
    expect(timeoutOf(prompter)).toBe(500);
  });

  it('stays unarmed in noTty mode', () => {
    const prompter = new Inquirerer({ noTty: true, input: inputStream(false), output });
    expect(timeoutOf(prompter)).toBeUndefined();
  });
});
