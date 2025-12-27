import { CLIOptions } from 'inquirerer';
import readline from 'readline';
import { Readable, Transform, Writable } from 'stream';
import { cleanAnsi } from 'clean-ansi';
import { humanizeKeySequences } from './keys';

/**
 * Represents a queued input response for the test harness.
 */
export interface InputResponse {
  /** Type of input: 'key' for keypress, 'read' for readline input */
  type: 'key' | 'read';
  /** The value to send (key sequence or text input) */
  value: string;
}

interface MockReadline {
  question: (questionText: string, cb: (input: string) => void) => void;
  close: () => void;
}

/**
 * The test environment provides mock streams and utilities for testing CLI applications.
 */
export interface TestEnvironment {
  /** CLI options configured with mock streams */
  options: Partial<CLIOptions>;
  /** Mock input stream (stdin) */
  mockInput: Readable;
  /** Mock output stream (stdout) */
  mockOutput: Writable;
  /** Captured output lines (ANSI stripped, key sequences humanized) */
  writeResults: string[];
  /** Captured transform stream results */
  transformResults: string[];
  /** Queue an input response to be sent to the CLI */
  enqueueInputResponse: (input: InputResponse) => void;
  /** Send a key sequence immediately */
  sendKey: (key: string) => void;
  /** Send text input followed by Enter */
  sendLine: (text: string) => void;
  /** Get all captured output as a single string */
  getOutput: () => string;
  /** Clear captured output */
  clearOutput: () => void;
}

function setupReadlineMock(
  inputQueue: InputResponse[],
  getCurrentIndex: () => number,
  incrementIndex: () => void
): void {
  const originalCreateInterface = readline.createInterface;
  
  readline.createInterface = jest.fn().mockReturnValue({
    question: (questionText: string, cb: (input: string) => void) => {
      const currentIndex = getCurrentIndex();
      const nextInput = inputQueue[currentIndex];
      if (nextInput && nextInput.type === 'read') {
        incrementIndex();
        setTimeout(() => cb(nextInput.value), 1);
      }
    },
    close: jest.fn(),
  } as MockReadline);
}

/**
 * Creates a test environment for testing inquirerer-based CLI applications.
 * Call this in your test's beforeEach to get a fresh environment for each test.
 * 
 * @example
 * ```typescript
 * import { createTestEnvironment, KEY_SEQUENCES } from '@inquirerer/test';
 * 
 * describe('my CLI', () => {
 *   let env: TestEnvironment;
 * 
 *   beforeEach(() => {
 *     env = createTestEnvironment();
 *   });
 * 
 *   it('should handle user input', async () => {
 *     env.enqueueInputResponse({ type: 'key', value: KEY_SEQUENCES.ENTER });
 *     
 *     const prompter = new Inquirerer(env.options);
 *     const result = await prompter.prompt({}, questions);
 *     
 *     expect(env.getOutput()).toContain('expected output');
 *   });
 * });
 * ```
 */
export function createTestEnvironment(): TestEnvironment {
  const writeResults: string[] = [];
  const transformResults: string[] = [];
  const inputQueue: InputResponse[] = [];
  let currentInputIndex = 0;
  let lastScheduledTime = 0;

  // Clear any previous mocks
  if (typeof jest !== 'undefined') {
    jest.clearAllMocks();
  }

  const mockInput = new Readable({ read() {} });
  (mockInput as any).setRawMode = jest.fn();

  const mockOutput = new Writable({
    write: (chunk, encoding, callback) => {
      const str = chunk.toString();
      const humanizedStr = humanizeKeySequences(str);
      const cleanStr = cleanAnsi(humanizedStr);
      writeResults.push(cleanStr);
      callback();
    }
  });

  const options: Partial<CLIOptions> = {
    noTty: false,
    input: mockInput,
    output: mockOutput,
    minimistOpts: {
      alias: {
        v: 'version'
      }
    }
  };

  const transformStream = new Transform({
    transform(chunk, encoding, callback) {
      const data = chunk.toString();
      const humanizedData = humanizeKeySequences(data);
      const cleanData = cleanAnsi(humanizedData);
      transformResults.push(cleanData);
      this.push(chunk);
      callback();
    }
  });

  setupReadlineMock(
    inputQueue,
    () => currentInputIndex,
    () => { currentInputIndex++; }
  );
  mockInput.pipe(transformStream);

  const enqueueInputResponse = (input: InputResponse) => {
    lastScheduledTime += 1;

    if (input.type === 'key') {
      setTimeout(() => mockInput.push(input.value), lastScheduledTime);
    } else {
      inputQueue.push(input);
    }
  };

  const sendKey = (key: string) => {
    enqueueInputResponse({ type: 'key', value: key });
  };

  const sendLine = (text: string) => {
    enqueueInputResponse({ type: 'read', value: text });
  };

  const getOutput = () => writeResults.join('');

  const clearOutput = () => {
    writeResults.length = 0;
    transformResults.length = 0;
  };

  return {
    options,
    mockInput,
    mockOutput,
    writeResults,
    transformResults,
    enqueueInputResponse,
    sendKey,
    sendLine,
    getOutput,
    clearOutput
  };
}

/**
 * Sets up test utilities and returns a function that creates a fresh TestEnvironment.
 * This is useful for Jest's beforeEach pattern.
 * 
 * @example
 * ```typescript
 * import { setupTests } from '@inquirerer/test';
 * 
 * const getEnv = setupTests();
 * 
 * describe('my CLI', () => {
 *   let env: TestEnvironment;
 * 
 *   beforeEach(() => {
 *     env = getEnv();
 *   });
 * 
 *   // ... tests
 * });
 * ```
 */
export function setupTests(): () => TestEnvironment {
  return createTestEnvironment;
}
