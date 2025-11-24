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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Inquirerer - defaultFrom feature', () => {
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
        // Process the queued inputs when question is called
        const nextInput = inputQueue[currentInputIndex++];
        if (nextInput && nextInput.type === 'read') {
          setTimeout(() => cb(nextInput.value), 350); // Simulate readline delay
        }
      },
      close: jest.fn(),
    });
  }

  function enqueueInputResponse(input: { type: 'key' | 'read', value: string }) {
    if (input.type === 'key') {
      // Push key events directly to mockInput
      // @ts-ignore
      setTimeout(() => mockInput.push(input.value), 350);
    } else {
      // Queue readline responses to be handled by the readline mock
      inputQueue.push(input);
    }
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
    mockInput.setRawMode = jest.fn();  // Mock TTY-specific method if needed

    mockOutput = new Writable({
      write: (chunk, encoding, callback) => {
        const str = chunk.toString();
        writeResults.push(stripAnsi(str));
        mockWrite(str);
        callback();
      }
    });

    // Create the transform stream to log and pass through data
    transformStream = new Transform({
      transform(chunk, encoding, callback) {
        const data = chunk.toString();
        transformResults.push(stripAnsi(data));
        this.push(chunk); // Pass the data through
        callback();
      }
    });

    setupReadlineMock();
    mockInput.pipe(transformStream);

    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-11-23T15:30:45.123Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('git resolvers', () => {
    it('should use git.user.name as default', async () => {
      mockedExecSync.mockReturnValue('John Doe\n' as any);

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true  // Non-interactive mode to use defaults
      });

      const questions: Question[] = [
        {
          name: 'authorName',
          type: 'text',
          defaultFrom: 'git.user.name'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ authorName: 'John Doe' });
      expect(mockedExecSync).toHaveBeenCalledWith(
        'git config --global user.name',
        expect.any(Object)
      );
    });

    it('should use git.user.email as default', async () => {
      mockedExecSync.mockReturnValue('john@example.com\n' as any);

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'authorEmail',
          type: 'text',
          defaultFrom: 'git.user.email'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ authorEmail: 'john@example.com' });
      expect(mockedExecSync).toHaveBeenCalledWith(
        'git config --global user.email',
        expect.any(Object)
      );
    });

    it('should fallback to static default when git config fails', async () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('Git not configured');
      });

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'authorName',
          type: 'text',
          defaultFrom: 'git.user.name',
          default: 'Anonymous'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ authorName: 'Anonymous' });
    });

    it('should resolve multiple git fields', async () => {
      mockedExecSync
        .mockReturnValueOnce('Jane Smith\n' as any)
        .mockReturnValueOnce('jane@example.com\n' as any);

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'name',
          type: 'text',
          defaultFrom: 'git.user.name'
        },
        {
          name: 'email',
          type: 'text',
          defaultFrom: 'git.user.email'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({
        name: 'Jane Smith',
        email: 'jane@example.com'
      });
    });
  });

  describe('date resolvers', () => {
    it('should use date.year as default', async () => {
      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'year',
          type: 'text',
          defaultFrom: 'date.year'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ year: '2025' });
    });

    it('should use date.iso as default', async () => {
      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'date',
          type: 'text',
          defaultFrom: 'date.iso'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ date: '2025-11-23' });
    });

    it('should resolve multiple date fields', async () => {
      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'year',
          type: 'text',
          defaultFrom: 'date.year'
        },
        {
          name: 'month',
          type: 'text',
          defaultFrom: 'date.month'
        },
        {
          name: 'day',
          type: 'text',
          defaultFrom: 'date.day'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({
        year: '2025',
        month: '11',
        day: '23'
      });
    });
  });

  describe('custom resolver registry', () => {
    it('should use custom resolver registry', async () => {
      const customRegistry = new DefaultResolverRegistry();
      customRegistry.register('custom.value', () => 'custom-result');

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true,
        resolverRegistry: customRegistry
      });

      const questions: Question[] = [
        {
          name: 'customField',
          type: 'text',
          defaultFrom: 'custom.value'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ customField: 'custom-result' });
    });

    it('should use custom async resolver', async () => {
      const customRegistry = new DefaultResolverRegistry();
      customRegistry.register('custom.async', async () => {
        // Return a promise without setTimeout to avoid issues with fake timers
        return Promise.resolve('async-result');
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
          defaultFrom: 'custom.async'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ asyncField: 'async-result' });
    });
  });

  describe('priority and fallbacks', () => {
    it('should prioritize argv over defaultFrom', async () => {
      mockedExecSync.mockReturnValue('Git User\n' as any);

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'authorName',
          type: 'text',
          defaultFrom: 'git.user.name'
        }
      ];

      const result = await prompter.prompt({ authorName: 'Override' }, questions);

      expect(result).toEqual({ authorName: 'Override' });
      // Git should not even be called since argv overrides
    });

    it('should use undefined when resolver returns undefined and no static default', async () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('Git not configured');
      });

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'authorName',
          type: 'text',
          defaultFrom: 'git.user.name'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ authorName: undefined });
    });

    it('should handle mixed defaultFrom and static defaults', async () => {
      mockedExecSync.mockReturnValue('Jane Doe\n' as any);

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'authorName',
          type: 'text',
          defaultFrom: 'git.user.name'
        },
        {
          name: 'license',
          type: 'text',
          default: 'MIT'  // Static default only
        },
        {
          name: 'year',
          type: 'text',
          defaultFrom: 'date.year'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({
        authorName: 'Jane Doe',
        license: 'MIT',
        year: '2025'
      });
    });
  });

  describe('question types with defaultFrom', () => {
    it('should work with confirm type', async () => {
      const customRegistry = new DefaultResolverRegistry();
      customRegistry.register('custom.bool', () => true);

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true,  // Non-interactive to avoid readline complexity
        resolverRegistry: customRegistry
      });

      const questions: Question[] = [
        {
          name: 'confirmed',
          type: 'confirm',
          defaultFrom: 'custom.bool'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ confirmed: true });
    });

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
          defaultFrom: 'custom.number'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ count: 42 });
    });
  });

  describe('edge cases', () => {
    it('should handle resolver that returns empty string', async () => {
      const customRegistry = new DefaultResolverRegistry();
      customRegistry.register('custom.empty', () => '');

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
          defaultFrom: 'custom.empty',
          default: 'fallback'
        }
      ];

      const result = await prompter.prompt({}, questions);

      // Empty string from resolver is treated as undefined, should use static default
      expect(result).toEqual({ field: 'fallback' });
    });

    it('should handle resolver that throws error gracefully', async () => {
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
          defaultFrom: 'custom.error',
          default: 'fallback'
        }
      ];

      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ field: 'fallback' });
    });

    it('should not override when defaultFrom resolver fails and field is required', async () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('Git not configured');
      });

      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'authorName',
          type: 'text',
          required: true,
          defaultFrom: 'git.user.name'
        }
      ];

      // Should throw because required field has no value
      await expect(prompter.prompt({}, questions)).rejects.toThrow(
        'Missing required arguments'
      );
    });
  });
});
