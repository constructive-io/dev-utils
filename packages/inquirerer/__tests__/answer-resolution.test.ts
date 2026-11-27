import { PassThrough } from 'stream';

import { Inquirerer, OptionValue, Question } from '../src';

function questions(): Question[] {
  return [
    { name: 'label', type: 'text', default: 'fallback' },
    { name: 'count', type: 'number', default: 7 },
    { name: 'confirm', type: 'confirm', default: true },
    { name: 'enabled', type: 'boolean', default: true },
    { name: 'settings', type: 'json', default: { preset: true } },
    { name: 'mode', type: 'list', options: ['basic', { name: 'Advanced', value: 'advanced' }], default: 'basic' },
    { name: 'color', type: 'autocomplete', options: ['blue', 'red'], default: 'blue' },
    { name: 'features', type: 'checkbox', options: ['search', 'reporting'], default: ['search'] },
  ];
}

const flags = {
  label: 'provided',
  count: 0,
  confirm: false,
  enabled: false,
  settings: { preset: false },
  mode: 'Advanced',
  color: 'red',
  features: ['reporting'],
};
const resolvedFlags = {
  ...flags,
  mode: 'advanced',
  features: [{ name: 'reporting', value: 'reporting', selected: true }],
};
const defaults = {
  label: 'fallback',
  count: 7,
  confirm: true,
  enabled: true,
  settings: { preset: true },
  mode: 'basic',
  color: 'blue',
  features: [{ name: 'search', value: 'search', selected: true }],
};

function mockTerminal(responses: string[] = [], enter = '\n') {
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode: jest.fn() });
  const output = new PassThrough();
  let prompts = 0;
  output.on('data', chunk => {
    if (chunk.toString().includes('Read the missing answer')) {
      const response = responses[prompts++];
      if (response !== undefined) {
        queueMicrotask(() => input.write(response + enter));
      }
    }
  });
  return { input, output, timeout: 500, prompts: () => prompts };
}

describe('answer resolution', () => {
  it('uses all supplied required flags instead of defaults in noTty mode', async () => {
    const prompter = new Inquirerer({ noTty: true });
    const required = questions().map(question => ({ ...question, required: true }));
    await expect(prompter.prompt({ ...flags }, required)).resolves.toEqual(resolvedFlags);
  });

  it.each([false, true])('resolves defaults by type in noTty mode (required: %s)', async required => {
    const prompter = new Inquirerer({ noTty: true });
    const inputs = questions().map(question => ({ ...question, required }));
    await expect(prompter.prompt({}, inputs)).resolves.toEqual(defaults);
  });

  it('rejects a required answer without a default and preserves provided flags', async () => {
    const prompter = new Inquirerer({ noTty: true, output: new PassThrough() });
    const argv = { label: '', count: 0, confirm: false };
    const inputs: Question[] = [
      ...questions().slice(0, 3),
      { name: 'requiredValue', type: 'text', required: true },
    ];
    await expect(prompter.prompt(argv, inputs)).rejects.toThrow('Missing required arguments');
    expect(argv).toEqual({ label: '', count: 0, confirm: false });
  });

  it('fills a required default without replacing false, zero, or an optional empty string', async () => {
    const prompter = new Inquirerer({ noTty: true });
    const inputs: Question[] = [
      ...questions().slice(0, 3),
      { name: 'role', type: 'text', required: true, default: 'editor' },
    ];
    await expect(prompter.prompt({ label: '', count: 0, confirm: false }, inputs))
      .resolves.toEqual({ label: '', count: 0, confirm: false, role: 'editor' });
  });

  it.each(['useDefault', 'useDefaults'])('%s skips prompts for defaults but does not supersede flags', async option => {
    const prompter = new Inquirerer({
      input: new PassThrough(),
      output: new PassThrough(),
      timeout: 100,
      useDefaults: option === 'useDefaults',
    });
    const inputs = questions().map(question => ({ ...question, useDefault: option === 'useDefault' }));
    try {
      await expect(prompter.prompt({ label: '', count: 0, confirm: false }, inputs))
        .resolves.toEqual({ ...defaults, label: '', count: 0, confirm: false });
    } finally {
      prompter.close();
    }
  });

  it('includes unselected checkbox options when resolving a required default with returnFullResults', async () => {
    const prompter = new Inquirerer({ noTty: true });
    await expect(prompter.prompt({}, [{
      name: 'features',
      type: 'checkbox',
      options: ['search', 'reporting'],
      default: ['search'],
      required: true,
      returnFullResults: true,
    }])).resolves.toEqual({
      features: [...defaults.features, { name: 'reporting', value: 'reporting', selected: false }],
    });
  });

  it.each([false, true])('accepts checkbox defaults by option value (returnFullResults: %s)', async returnFullResults => {
    const question: Question = {
      name: 'features',
      type: 'checkbox',
      options: [{ name: 'Search', value: 'search' }, 'reporting'],
      default: ['search'],
      required: true,
      returnFullResults,
    };
    const features = [{ name: 'Search', value: 'search', selected: true }];
    if (returnFullResults) {
      features.push({ name: 'reporting', value: 'reporting', selected: false });
    }
    const prompter = new Inquirerer({ noTty: true });
    await expect(prompter.prompt({}, [question])).resolves.toEqual({ features });
    const withFlag = new Inquirerer({ noTty: true });
    await expect(withFlag.prompt({ features: ['search'] }, [question])).resolves.toEqual({ features });
    const interactive = new Inquirerer(mockTerminal([''], '\r'));
    try {
      await expect(interactive.prompt({}, [{ ...question, message: 'Read the missing answer' }]))
        .resolves.toEqual({ features });
    } finally {
      interactive.close();
    }
  });

  it.each([{ selection: [] }, { selection: ['unknown'] }])('rejects a required full-results checkbox with no selected option ($selection)', async ({ selection }) => {
    const question: Question = {
      name: 'features',
      type: 'checkbox',
      options: ['search', 'reporting'],
      default: selection,
      required: true,
      returnFullResults: true,
    };
    const prompter = new Inquirerer({ noTty: true, output: new PassThrough() });
    await expect(prompter.prompt({}, [question])).rejects.toThrow('Missing required arguments');
  });

  it.each([false, true])('preserves all flag types while reading a missing TTY answer (retry: %s)', async retry => {
    const terminal = mockTerminal(retry ? ['invalid', 'accepted'] : ['accepted']);
    const prompter = new Inquirerer(terminal);
    const validate = jest.fn((answer, answers) => answer === 'accepted' && answers.count === 0);
    try {
      await expect(prompter.prompt({ ...flags }, [
        ...questions(),
        { name: 'extra', type: 'text', message: 'Read the missing answer', validate },
      ])).resolves.toEqual({ ...resolvedFlags, extra: 'accepted' });
      expect(terminal.prompts()).toBe(retry ? 2 : 1);
      expect(validate.mock.calls.map(([answer]) => answer)).toEqual(retry ? ['invalid', 'accepted'] : ['accepted']);
    } finally {
      prompter.close();
    }
  });

  it('keeps named flags ahead of positionals and positionals ahead of required defaults', async () => {
    const prompter = new Inquirerer({ noTty: true, mutateArgs: false });
    const inputs = questions().map(question => ({ ...question, _: true, required: true }));
    const argv = { label: flags.label, _: [flags.count, flags.confirm, flags.enabled, flags.settings,
      flags.mode, flags.color, flags.features] };
    await expect(prompter.prompt(argv, [
      ...inputs,
      { name: 'role', type: 'text', required: true, default: 'editor' },
    ])).resolves.toEqual({ ...resolvedFlags, _: [], role: 'editor' });
    expect(argv._).toHaveLength(7);
  });

  it.each([false, true])('keeps supplied answers even when their question is disabled (noTty: %s)', async noTty => {
    const prompter = new Inquirerer({ ...mockTerminal(), noTty, useDefaults: true });
    const inputs: Question[] = [
      ...questions().map(question => ({ ...question, dependsOn: ['role'], when: () => false })),
      { name: 'hidden', type: 'text', required: true, dependsOn: ['role'], when: () => false },
      { name: 'unused', type: 'text', default: 'unused', dependsOn: ['role'], when: () => false },
      { name: 'shown', type: 'text', required: true, default: 'shown', dependsOn: ['role'],
        when: answers => answers.role === 'editor' },
      { name: 'role', type: 'text', required: true, default: 'editor' },
    ];
    try {
      await expect(prompter.prompt({ ...flags }, inputs))
        .resolves.toEqual({ ...resolvedFlags, role: 'editor', shown: 'shown' });
    } finally {
      prompter.close();
    }
  });

  it('preserves supplied flags when a noninteractive answer fails validation', async () => {
    const prompter = new Inquirerer({ noTty: true, output: new PassThrough() });
    const argv = { ...flags };
    const validate = jest.fn(() => false);
    await expect(prompter.prompt(argv, [
      ...questions(),
      { name: 'extra', type: 'text', default: 'invalid', validate },
    ])).rejects.toThrow('Missing required arguments');
    expect(validate).toHaveBeenCalledTimes(1);
    expect(argv).toMatchObject(resolvedFlags);
  });

  it('resolves dependency defaults before checking a required condition in noTty mode', async () => {
    const prompter = new Inquirerer({ noTty: true });
    await expect(prompter.prompt({}, [
      { name: 'role', type: 'text', required: true, default: 'editor', dependsOn: ['settings'],
        when: answers => answers.settings.enabled },
      { name: 'settings', type: 'json', default: { enabled: true } },
    ])).resolves.toEqual({ settings: { enabled: true }, role: 'editor' });
  });

  it('rejects but does not replace a supplied empty flag when a default activates its requirement', async () => {
    const prompter = new Inquirerer({ noTty: true, output: new PassThrough() });
    const argv = { role: '' };
    await expect(prompter.prompt(argv, [
      { name: 'role', type: 'text', required: true, default: 'editor', dependsOn: ['enabled'],
        when: answers => answers.enabled === true },
      { name: 'enabled', type: 'confirm', default: true },
    ])).rejects.toThrow('Missing required arguments');
    expect(argv.role).toBe('');
  });

  it('accepts a required interactive checkbox after sanitizing selections to IDs', async () => {
    const prompter = new Inquirerer(mockTerminal([''], '\r'));
    try {
      await expect(prompter.prompt({}, [{
        name: 'features',
        type: 'checkbox',
        options: ['search', 'reporting'],
        default: ['search'],
        required: true,
        returnFullResults: true,
        message: 'Read the missing answer',
        sanitize: (options: OptionValue[]) => options.filter(option => option.selected).map(option => option.value),
      }])).resolves.toEqual({ features: ['search'] });
    } finally {
      prompter.close();
    }
  });

  it.each(['TTY', 'noTty', 'useDefault', 'useDefaults'])(
    'resolves aliases for every flag type without falling back to defaults (%s)',
    async path => {
      const noTty = path === 'noTty';
      const terminal = mockTerminal(['typed']);
      const prompter = new Inquirerer({ ...terminal, noTty, useDefaults: path === 'useDefaults' });
      const inputs = questions().map(question => ({ ...question, alias: 'alias-' + question.name }));
      const aliases = Object.fromEntries(Object.entries(flags).map(([key, value]) => ['alias-' + key, value]));
      const argv = { ...aliases };
      try {
        await expect(prompter.prompt(argv, [
          ...inputs,
          { name: 'extra', type: 'text', required: true, default: 'default', message: 'Read the missing answer',
            useDefault: path === 'useDefault' },
        ], { mutateArgs: false })).resolves.toEqual({
          ...resolvedFlags,
          extra: path === 'TTY' ? 'typed' : 'default',
        });
        expect(argv).toEqual(aliases);
        expect(terminal.prompts()).toBe(path === 'TTY' ? 1 : 0);
      } finally {
        prompter.close();
      }
    }
  );
});
