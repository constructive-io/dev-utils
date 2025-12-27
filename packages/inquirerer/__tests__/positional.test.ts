import { Inquirerer } from '../src';
import { Question } from '../src/question';

interface TestResult {
  _?: any[];
  [key: string]: any;
}

describe('Positional Arguments (_: true)', () => {
  let prompter: Inquirerer;

  beforeEach(() => {
    prompter = new Inquirerer({ noTty: true });
  });

  afterEach(() => {
    prompter.close();
  });

  describe('Basic positional argument handling', () => {
    it('assigns single positional argument to question with _: true', async () => {
      const questions: Question[] = [
        { _: true, name: 'database', type: 'text', required: true }
      ];
      const argv: TestResult = { _: ['mydb1'] };

      const result = await prompter.prompt(argv, questions);

      expect(result.database).toBe('mydb1');
    });

    it('assigns multiple positional arguments in declaration order', async () => {
      const questions: Question[] = [
        { _: true, name: 'foo', type: 'text' },
        { name: 'bar', type: 'text', default: 'default-bar' },
        { _: true, name: 'baz', type: 'text' }
      ];
      const argv: TestResult = { _: ['1', '3'], bar: '2' };

      const result = await prompter.prompt(argv, questions);

      expect(result.foo).toBe('1');
      expect(result.bar).toBe('2');
      expect(result.baz).toBe('3');
    });

    it('works with numeric positional values', async () => {
      const questions: Question[] = [
        { _: true, name: 'port', type: 'number' }
      ];
      const argv: TestResult = { _: [3000] };

      const result = await prompter.prompt(argv, questions);

      expect(result.port).toBe(3000);
    });

    it('works without any positional arguments (empty argv._)', async () => {
      const questions: Question[] = [
        { _: true, name: 'foo', type: 'text', default: 'default-foo' }
      ];
      const argv: TestResult = { _: [] };

      const result = await prompter.prompt(argv, questions);

      expect(result.foo).toBe('default-foo');
    });

    it('works when argv._ is undefined', async () => {
      const questions: Question[] = [
        { _: true, name: 'foo', type: 'text', default: 'default-foo' }
      ];
      const argv: TestResult = {};

      const result = await prompter.prompt(argv, questions);

      expect(result.foo).toBe('default-foo');
    });
  });

  describe('Named arguments take precedence over positional', () => {
    it('uses named argument when both positional and named are provided', async () => {
      const questions: Question[] = [
        { _: true, name: 'database', type: 'text' }
      ];
      const argv: TestResult = { _: ['positional-db'], database: 'named-db' };

      const result = await prompter.prompt(argv, questions);

      expect(result.database).toBe('named-db');
    });

    it('does not consume positional when named argument is used', async () => {
      const questions: Question[] = [
        { _: true, name: 'foo', type: 'text' },
        { _: true, name: 'bar', type: 'text' }
      ];
      // foo is provided via --foo, so the positional 'first' should go to bar
      const argv: TestResult = { _: ['first'], foo: 'named-foo' };

      const result = await prompter.prompt(argv, questions);

      expect(result.foo).toBe('named-foo');
      expect(result.bar).toBe('first');
    });

    it('handles mixed named and positional with multiple questions', async () => {
      const questions: Question[] = [
        { _: true, name: 'a', type: 'text' },
        { _: true, name: 'b', type: 'text' },
        { _: true, name: 'c', type: 'text' }
      ];
      // b is provided via --b, so positionals go to a and c
      const argv: TestResult = { _: ['pos1', 'pos2'], b: 'named-b' };

      const result = await prompter.prompt(argv, questions);

      expect(result.a).toBe('pos1');
      expect(result.b).toBe('named-b');
      expect(result.c).toBe('pos2');
    });

    it('handles all named arguments with positionals left over', async () => {
      const questions: Question[] = [
        { _: true, name: 'foo', type: 'text' },
        { _: true, name: 'bar', type: 'text' }
      ];
      const argv: TestResult = { _: ['extra1', 'extra2'], foo: 'named-foo', bar: 'named-bar' };

      const result = await prompter.prompt(argv, questions);

      expect(result.foo).toBe('named-foo');
      expect(result.bar).toBe('named-bar');
      // No positionals consumed (all questions had named args), so all remain
      expect(result._).toEqual(['extra1', 'extra2']);
    });
  });

  describe('Extra and missing positional values', () => {
    it('strips consumed positionals and leaves extras in result._', async () => {
      const questions: Question[] = [
        { _: true, name: 'first', type: 'text' }
      ];
      const argv: TestResult = { _: ['value1', 'value2', 'value3'] };

      const result = await prompter.prompt(argv, questions);

      expect(result.first).toBe('value1');
      // Consumed positionals are stripped, extras remain in result._
      expect(result._).toEqual(['value2', 'value3']);
      // Original argv._ is also mutated (default mutateArgs: true)
      expect(argv._).toEqual(['value2', 'value3']);
    });

    it('handles fewer positional values than positional questions', async () => {
      const questions: Question[] = [
        { _: true, name: 'first', type: 'text' },
        { _: true, name: 'second', type: 'text', default: 'default-second' },
        { _: true, name: 'third', type: 'text', default: 'default-third' }
      ];
      const argv: TestResult = { _: ['only-one'] };

      const result = await prompter.prompt(argv, questions);

      expect(result.first).toBe('only-one');
      expect(result.second).toBe('default-second');
      expect(result.third).toBe('default-third');
    });
  });

  describe('Interleaved positional and non-positional questions', () => {
    it('correctly assigns positionals with non-positional questions in between', async () => {
      const questions: Question[] = [
        { _: true, name: 'pos1', type: 'text' },
        { name: 'named1', type: 'text', default: 'default-named1' },
        { _: true, name: 'pos2', type: 'text' },
        { name: 'named2', type: 'text', default: 'default-named2' },
        { _: true, name: 'pos3', type: 'text' }
      ];
      const argv: TestResult = { _: ['a', 'b', 'c'] };

      const result = await prompter.prompt(argv, questions);

      expect(result.pos1).toBe('a');
      expect(result.pos2).toBe('b');
      expect(result.pos3).toBe('c');
      expect(result.named1).toBe('default-named1');
      expect(result.named2).toBe('default-named2');
    });

    it('handles named args for non-positional questions alongside positionals', async () => {
      const questions: Question[] = [
        { _: true, name: 'pos1', type: 'text' },
        { name: 'named1', type: 'text' },
        { _: true, name: 'pos2', type: 'text' }
      ];
      const argv: TestResult = { _: ['first', 'second'], named1: 'named-value' };

      const result = await prompter.prompt(argv, questions);

      expect(result.pos1).toBe('first');
      expect(result.named1).toBe('named-value');
      expect(result.pos2).toBe('second');
    });
  });

  describe('Positional with list/autocomplete options', () => {
    it('maps positional value through list options', async () => {
      const questions: Question[] = [
        {
          _: true,
          name: 'framework',
          type: 'list',
          options: [
            { name: 'React', value: 'react' },
            { name: 'Vue', value: 'vue' },
            { name: 'Angular', value: 'angular' }
          ]
        }
      ];
      const argv: TestResult = { _: ['React'] };

      const result = await prompter.prompt(argv, questions);

      expect(result.framework).toBe('react');
    });

    it('maps positional value through autocomplete options', async () => {
      const questions: Question[] = [
        {
          _: true,
          name: 'database',
          type: 'autocomplete',
          options: [
            { name: 'PostgreSQL', value: 'postgres' },
            { name: 'MySQL', value: 'mysql' },
            { name: 'SQLite', value: 'sqlite' }
          ]
        }
      ];
      const argv: TestResult = { _: ['PostgreSQL'] };

      const result = await prompter.prompt(argv, questions);

      expect(result.database).toBe('postgres');
    });

    it('allows custom options when allowCustomOptions is true', async () => {
      const questions: Question[] = [
        {
          _: true,
          name: 'framework',
          type: 'autocomplete',
          options: ['React', 'Vue'],
          allowCustomOptions: true
        }
      ];
      const argv: TestResult = { _: ['CustomFramework'] };

      const result = await prompter.prompt(argv, questions);

      expect(result.framework).toBe('CustomFramework');
    });
  });

  describe('Positional with checkbox (array handling)', () => {
    it('handles single positional value for checkbox', async () => {
      const questions: Question[] = [
        {
          _: true,
          name: 'features',
          type: 'checkbox',
          options: ['Auth', 'Database', 'API']
        }
      ];
      const argv: TestResult = { _: ['Auth'] };

      const result = await prompter.prompt(argv, questions);

      expect(result.features).toEqual([{ name: 'Auth', value: 'Auth', selected: true }]);
    });

    it('handles checkbox with returnFullResults', async () => {
      const questions: Question[] = [
        {
          _: true,
          name: 'features',
          type: 'checkbox',
          options: ['Auth', 'Database', 'API'],
          returnFullResults: true
        }
      ];
      const argv: TestResult = { _: ['Database'] };

      const result = await prompter.prompt(argv, questions);

      expect(result.features).toEqual([
        { name: 'Auth', value: 'Auth', selected: false },
        { name: 'Database', value: 'Database', selected: true },
        { name: 'API', value: 'API', selected: false }
      ]);
    });
  });

  describe('mutateArgs behavior', () => {
    it('mutates argv and strips positionals when mutateArgs is true (default)', async () => {
      const questions: Question[] = [
        { _: true, name: 'foo', type: 'text' }
      ];
      const argv: TestResult = { _: ['value1', 'extra'] };

      const result = await prompter.prompt(argv, questions);

      // argv should have foo added and _ stripped
      expect(argv).toHaveProperty('foo', 'value1');
      expect(argv._).toEqual(['extra']);
      // result should also have stripped _
      expect(result._).toEqual(['extra']);
    });

    it('does not mutate original argv when mutateArgs is false', async () => {
      const nonMutatingPrompter = new Inquirerer({ noTty: true, mutateArgs: false });
      const questions: Question[] = [
        { _: true, name: 'foo', type: 'text' }
      ];
      const argv: TestResult = { _: ['value1', 'extra'] };

      const result = await nonMutatingPrompter.prompt(argv, questions);

      // Result should have the value and stripped _
      expect(result.foo).toBe('value1');
      expect(result._).toEqual(['extra']);
      // Original argv should NOT be mutated
      expect(argv._).toEqual(['value1', 'extra']);
      expect(argv).not.toHaveProperty('foo');
      nonMutatingPrompter.close();
    });

    it('respects mutateArgs: false in prompt options', async () => {
      const questions: Question[] = [
        { _: true, name: 'foo', type: 'text' }
      ];
      const argv: TestResult = { _: ['value1', 'extra'] };

      const result = await prompter.prompt(argv, questions, { mutateArgs: false });

      expect(result.foo).toBe('value1');
      expect(result._).toEqual(['extra']);
      // Original argv should NOT be mutated
      expect(argv._).toEqual(['value1', 'extra']);
    });
  });

  describe('Required positional questions in noTty mode', () => {
    it('satisfies required question with positional argument', async () => {
      const questions: Question[] = [
        { _: true, name: 'database', type: 'text', required: true }
      ];
      const argv: TestResult = { _: ['mydb'] };

      const result = await prompter.prompt(argv, questions);

      expect(result.database).toBe('mydb');
    });

    it('throws error for missing required positional in noTty mode', async () => {
      const questions: Question[] = [
        { _: true, name: 'database', type: 'text', required: true }
      ];
      const argv: TestResult = { _: [] };

      await expect(prompter.prompt(argv, questions)).rejects.toThrow(
        'Missing required arguments'
      );
    });
  });

  describe('Edge cases and complex scenarios', () => {
    it('handles questions where some have _: true and some have _: false', async () => {
      const questions: Question[] = [
        { _: true, name: 'pos', type: 'text' },
        { _: false, name: 'notPos', type: 'text', default: 'default' },
        { name: 'alsoNotPos', type: 'text', default: 'also-default' }
      ];
      const argv: TestResult = { _: ['positional-value'] };

      const result = await prompter.prompt(argv, questions);

      expect(result.pos).toBe('positional-value');
      expect(result.notPos).toBe('default');
      expect(result.alsoNotPos).toBe('also-default');
    });

    it('handles empty string as positional value', async () => {
      const questions: Question[] = [
        { _: true, name: 'foo', type: 'text' }
      ];
      const argv: TestResult = { _: [''] };

      const result = await prompter.prompt(argv, questions);

      expect(result.foo).toBe('');
    });

    it('handles boolean-like string positional values', async () => {
      const questions: Question[] = [
        { _: true, name: 'flag', type: 'text' }
      ];
      const argv: TestResult = { _: ['true'] };

      const result = await prompter.prompt(argv, questions);

      expect(result.flag).toBe('true');
    });

    it('preserves order when all questions are positional', async () => {
      const questions: Question[] = [
        { _: true, name: 'first', type: 'text' },
        { _: true, name: 'second', type: 'text' },
        { _: true, name: 'third', type: 'text' },
        { _: true, name: 'fourth', type: 'text' }
      ];
      const argv: TestResult = { _: ['a', 'b', 'c', 'd'] };

      const result = await prompter.prompt(argv, questions);

      expect(result.first).toBe('a');
      expect(result.second).toBe('b');
      expect(result.third).toBe('c');
      expect(result.fourth).toBe('d');
    });

    it('handles complex mixed scenario', async () => {
      const questions: Question[] = [
        { _: true, name: 'source', type: 'text' },
        { name: 'verbose', type: 'confirm', default: false },
        { _: true, name: 'destination', type: 'text' },
        { name: 'format', type: 'list', options: ['json', 'xml', 'csv'], default: 'json' },
        { _: true, name: 'count', type: 'number' }
      ];
      const argv: TestResult = { 
        _: ['input.txt', 'output.txt', 42],
        verbose: true,
        format: 'csv'
      };

      const result = await prompter.prompt(argv, questions);

      expect(result.source).toBe('input.txt');
      expect(result.destination).toBe('output.txt');
      expect(result.count).toBe(42);
      expect(result.verbose).toBe(true);
      expect(result.format).toBe('csv');
    });

    it('handles when first positional question has named arg but others do not', async () => {
      const questions: Question[] = [
        { _: true, name: 'first', type: 'text' },
        { _: true, name: 'second', type: 'text' },
        { _: true, name: 'third', type: 'text' }
      ];
      // first is named, so positionals go to second and third
      const argv: TestResult = { _: ['pos1', 'pos2'], first: 'named-first' };

      const result = await prompter.prompt(argv, questions);

      expect(result.first).toBe('named-first');
      expect(result.second).toBe('pos1');
      expect(result.third).toBe('pos2');
    });

    it('handles when middle positional question has named arg', async () => {
      const questions: Question[] = [
        { _: true, name: 'first', type: 'text' },
        { _: true, name: 'second', type: 'text' },
        { _: true, name: 'third', type: 'text' }
      ];
      // second is named, so positionals go to first and third
      const argv: TestResult = { _: ['pos1', 'pos2'], second: 'named-second' };

      const result = await prompter.prompt(argv, questions);

      expect(result.first).toBe('pos1');
      expect(result.second).toBe('named-second');
      expect(result.third).toBe('pos2');
    });

    it('handles when last positional question has named arg', async () => {
      const questions: Question[] = [
        { _: true, name: 'first', type: 'text' },
        { _: true, name: 'second', type: 'text' },
        { _: true, name: 'third', type: 'text' }
      ];
      // third is named, so positionals go to first and second
      const argv: TestResult = { _: ['pos1', 'pos2'], third: 'named-third' };

      const result = await prompter.prompt(argv, questions);

      expect(result.first).toBe('pos1');
      expect(result.second).toBe('pos2');
      expect(result.third).toBe('named-third');
    });
  });
});
