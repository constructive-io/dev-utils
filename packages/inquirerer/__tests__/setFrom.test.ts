import readline from 'readline';
import { Readable, Transform, Writable } from 'stream';
import { stripAnsi } from 'clean-ansi';
import { Inquirerer, DefaultResolverRegistry } from '../src';
import { Question } from '../src/question';

jest.mock('readline');
jest.mock('child_process', () => ({
    execSync: jest.fn()
}));

import { execSync } from 'child_process';
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('Inquirerer - setFrom feature', () => {
  let mockWrite: jest.Mock;
  let mockInput: Readable;
  let mockOutput: Writable;
  let transformStream: Transform;

  let writeResults: string[];
  let transformResults: string[];

  let inputQueue: Array<{ type: 'key' | 'read', value: string }> = [];
  let currentInputIndex: number = 0;

  function setupReadlineMock() {
    readline.createInterface = jest.fn().mockReturnValue({
      question: (questionText: string, cb: (input: string) => void) => {
        const nextInput = inputQueue[currentInputIndex++];
        if (nextInput && nextInput.type === 'read') {
          setTimeout(() => cb(nextInput.value), 350);
        }
      },
      close: jest.fn(),
    });
  }

  beforeEach(() => {
    mockWrite = jest.fn();
    writeResults = [];
    transformResults = [];
    inputQueue = [];
    currentInputIndex = 0;

    mockInput = new Readable({
      read(size) { }
    });
    // @ts-ignore
    mockInput.setRawMode = jest.fn();

    mockOutput = new Writable({
      write: (chunk, encoding, callback) => {
        const str = chunk.toString();
        writeResults.push(stripAnsi(str));
        mockWrite(str);
        callback();
      }
    });

    transformStream = new Transform({
      transform(chunk, encoding, callback) {
        const data = chunk.toString();
        transformResults.push(stripAnsi(data));
        this.push(chunk);
        callback();
      }
    });

    setupReadlineMock();
    mockInput.pipe(transformStream);

    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('1967-07-14T10:30:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('basic setFrom functionality', () => {
    it('should set value directly from resolver, bypassing prompt', async () => {
      const customRegistry = new DefaultResolverRegistry();
      customRegistry.register('custom.value', () => 'auto-set-value');

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true,
        resolverRegistry: customRegistry
      });

      const questions: Question[] = [
        {
          name: 'autoField',
          type: 'text',
          setFrom: 'custom.value'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ autoField: 'auto-set-value' });
    });

    it('should use git.user.name with setFrom', async () => {
      mockedExecSync.mockReturnValue('John Doe\n' as any);

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'authorName',
          type: 'text',
          setFrom: 'git.user.name'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ authorName: 'John Doe' });
      expect(mockedExecSync).toHaveBeenCalledWith(
        'git config --global user.name',
        expect.any(Object)
      );
    });

    it('should use date.year with setFrom', async () => {
      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'year',
          type: 'text',
          setFrom: 'date.year'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ year: '1967' });
    });

    it('should use workspace resolvers with setFrom', async () => {
      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'repoName',
          type: 'text',
          setFrom: 'workspace.name'
        },
        {
          name: 'license',
          type: 'text',
          setFrom: 'workspace.license'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({
        repoName: 'dev-utils',
        license: 'MIT'
      });
    });
  });

  describe('setFrom vs defaultFrom behavior', () => {
    it('setFrom should set value directly while defaultFrom sets default', async () => {
      const customRegistry = new DefaultResolverRegistry();
      customRegistry.register('resolver.a', () => 'value-a');
      customRegistry.register('resolver.b', () => 'value-b');

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true,
        resolverRegistry: customRegistry
      });

      const questions: Question[] = [
        {
          name: 'fieldA',
          type: 'text',
          setFrom: 'resolver.a'  // Directly sets value
        },
        {
          name: 'fieldB',
          type: 'text',
          defaultFrom: 'resolver.b'  // Sets as default
        }
      ];

      const result = await prompter.prompt({}, questions);

      // Both should have values in noTty mode
      expect(result).toEqual({
        fieldA: 'value-a',
        fieldB: 'value-b'
      });
    });

    it('should allow both setFrom and defaultFrom on different questions', async () => {
      mockedExecSync.mockReturnValue('Git User\n' as any);

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'autoYear',
          type: 'text',
          setFrom: 'date.year'
        },
        {
          name: 'authorName',
          type: 'text',
          defaultFrom: 'git.user.name'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({
        autoYear: '1967',
        authorName: 'Git User'
      });
    });
  });

  describe('priority and overrides', () => {
    it('should prioritize argv over setFrom', async () => {
      const customRegistry = new DefaultResolverRegistry();
      customRegistry.register('custom.value', () => 'resolver-value');

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true,
        resolverRegistry: customRegistry
      });

      const questions: Question[] = [
        {
          name: 'field',
          type: 'text',
          setFrom: 'custom.value'
        }
      ];

      const result = await prompter.prompt({ field: 'argv-value' }, questions);

      expect(result).toEqual({ field: 'argv-value' });
    });

    it('should not set value when resolver returns undefined', async () => {
      const customRegistry = new DefaultResolverRegistry();
      customRegistry.register('custom.undefined', () => undefined);

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true,
        resolverRegistry: customRegistry
      });

      const questions: Question[] = [
        {
          name: 'field',
          type: 'text',
          setFrom: 'custom.undefined',
          default: 'fallback'
        }
      ];

      const result = await prompter.prompt({}, questions);

      // Should use static default since setFrom resolved to undefined
      expect(result).toEqual({ field: 'fallback' });
    });

    it('should handle resolver errors gracefully', async () => {
      const customRegistry = new DefaultResolverRegistry();
      customRegistry.register('custom.error', () => {
        throw new Error('Resolver error');
      });

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true,
        resolverRegistry: customRegistry
      });

      const questions: Question[] = [
        {
          name: 'field',
          type: 'text',
          setFrom: 'custom.error',
          default: 'fallback'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ field: 'fallback' });
    });
  });

  describe('async resolvers with setFrom', () => {
    it('should work with async resolvers', async () => {
      const customRegistry = new DefaultResolverRegistry();
      customRegistry.register('custom.async', async () => {
        return Promise.resolve('async-value');
      });

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true,
        resolverRegistry: customRegistry
      });

      const questions: Question[] = [
        {
          name: 'asyncField',
          type: 'text',
          setFrom: 'custom.async'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ asyncField: 'async-value' });
    });
  });

  describe('multiple setFrom fields', () => {
    it('should resolve multiple setFrom fields', async () => {
      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'year',
          type: 'text',
          setFrom: 'date.year'
        },
        {
          name: 'month',
          type: 'text',
          setFrom: 'date.month'
        },
        {
          name: 'day',
          type: 'text',
          setFrom: 'date.day'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({
        year: '1967',
        month: '07',
        day: '14'
      });
    });
  });

  describe('question types with setFrom', () => {
    it('should work with number type', async () => {
      const customRegistry = new DefaultResolverRegistry();
      customRegistry.register('custom.number', () => 42);

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true,
        resolverRegistry: customRegistry
      });

      const questions: Question[] = [
        {
          name: 'count',
          type: 'number',
          setFrom: 'custom.number'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ count: 42 });
    });

    it('should work with confirm type', async () => {
      const customRegistry = new DefaultResolverRegistry();
      customRegistry.register('custom.bool', () => true);

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true,
        resolverRegistry: customRegistry
      });

      const questions: Question[] = [
        {
          name: 'confirmed',
          type: 'confirm',
          setFrom: 'custom.bool'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ confirmed: true });
    });
  });
});
