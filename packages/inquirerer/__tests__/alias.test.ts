import readline from 'readline';
import { Readable, Transform, Writable } from 'stream';
import { stripAnsi } from 'clean-ansi';
import { Inquirerer } from '../src';
import { Question } from '../src/question';

jest.mock('readline');

describe('Inquirerer - alias feature', () => {
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
  });

  describe('basic alias functionality', () => {
    it('should expand single character alias to main name', async () => {
      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'workspace',
          type: 'confirm',
          alias: 'w'
        }
      ];

      // Pass -w (short alias) in argv
      const result = await prompter.prompt({ w: true }, questions);

      expect(result).toEqual({ workspace: true });
      expect(result).not.toHaveProperty('w');
    });

    it('should expand multi-character alias to main name', async () => {
      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'createWorkspace',
          type: 'confirm',
          alias: 'workspace'
        }
      ];

      const result = await prompter.prompt({ workspace: true }, questions);

      expect(result).toEqual({ createWorkspace: true });
      expect(result).not.toHaveProperty('workspace');
    });

    it('should support array of aliases', async () => {
      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'workspace',
          type: 'confirm',
          alias: ['w', 'ws']
        }
      ];

      // Test first alias
      const result1 = await prompter.prompt({ w: true }, questions);
      expect(result1).toEqual({ workspace: true });

      // Test second alias
      const result2 = await prompter.prompt({ ws: false }, questions);
      expect(result2).toEqual({ workspace: false });
    });

    it('should prioritize main name over alias', async () => {
      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'workspace',
          type: 'confirm',
          alias: 'w'
        }
      ];

      // Pass both main name and alias - main name should win
      // The alias key is not deleted when main name already exists
      const result = await prompter.prompt({ workspace: true, w: false }, questions);

      expect(result.workspace).toBe(true);
    });

    it('should work with text type questions', async () => {
      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'outputDir',
          type: 'text',
          alias: 'o',
          default: './dist'
        }
      ];

      const result = await prompter.prompt({ o: './build' }, questions);

      expect(result).toEqual({ outputDir: './build' });
    });

    it('should work with number type questions', async () => {
      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'port',
          type: 'number',
          alias: 'p',
          default: 3000
        }
      ];

      const result = await prompter.prompt({ p: 8080 }, questions);

      expect(result).toEqual({ port: 8080 });
    });

    it('should not affect questions without aliases', async () => {
      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'name',
          type: 'text',
          default: 'default-name'
        }
      ];

      const result = await prompter.prompt({ name: 'my-name' }, questions);

      expect(result).toEqual({ name: 'my-name' });
    });
  });

  describe('alias with multiple questions', () => {
    it('should expand aliases for multiple questions', async () => {
      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'workspace',
          type: 'confirm',
          alias: 'w'
        },
        {
          name: 'verbose',
          type: 'confirm',
          alias: 'v'
        },
        {
          name: 'outputDir',
          type: 'text',
          alias: 'o',
          default: './dist'
        }
      ];

      const result = await prompter.prompt({ w: true, v: false, o: './build' }, questions);

      expect(result).toEqual({
        workspace: true,
        verbose: false,
        outputDir: './build'
      });
    });
  });

  describe('alias edge cases', () => {
    it('should handle undefined alias value gracefully', async () => {
      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'field',
          type: 'text',
          alias: 'f',
          default: 'default-value'
        }
      ];

      // Neither main name nor alias provided
      const result = await prompter.prompt({}, questions);

      expect(result).toEqual({ field: 'default-value' });
    });

    it('should use first matching alias when multiple are provided in argv', async () => {
      const prompter = new Inquirerer({
        input: mockInput,
        output: mockOutput,
        noTty: true
      });

      const questions: Question[] = [
        {
          name: 'workspace',
          type: 'text',
          alias: ['w', 'ws']
        }
      ];

      // Both aliases provided - first one in alias array should be used
      // The second alias key remains in the result since it wasn't used for expansion
      const result = await prompter.prompt({ w: 'first', ws: 'second' }, questions) as any;

      expect(result.workspace).toBe('first');
    });
  });
});
