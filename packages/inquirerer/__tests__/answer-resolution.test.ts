import { PassThrough } from 'stream';

import { Inquirerer, Question } from '../src';

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
});
