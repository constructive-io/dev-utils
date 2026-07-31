import type { PartialThemeColors, SyntaxColors,Theme } from './types';

const defaultSyntaxColors: SyntaxColors = {
  keyword: { fg: 'magenta', bold: true },
  string: { fg: 'green' },
  number: { fg: 'cyan' },
  comment: { fg: 'gray', italic: true },
  operator: { fg: 'yellow' },
  punctuation: { fg: 'white' },
  function: { fg: 'blue', bold: true },
  variable: { fg: 'white' },
  type: { fg: 'cyan', bold: true },
  property: { fg: 'blue' },
  constant: { fg: 'red', bold: true },
  tag: { fg: 'red' },
  attribute: { fg: 'yellow' },
  text: {}
};

export const defaultTheme: Theme = {
  name: 'default',
  colors: {
    added: { fg: 'green', bg: 'bgBlack' },
    removed: { fg: 'red', bg: 'bgBlack' },
    unchanged: { fg: 'white' },
    lineNumber: { fg: 'gray', dim: true },
    header: { fg: 'cyan', bold: true },
    syntax: defaultSyntaxColors
  }
};

export const githubTheme: Theme = {
  name: 'github',
  colors: {
    added: { fg: 'greenBright', bg: 'bgBlack' },
    removed: { fg: 'redBright', bg: 'bgBlack' },
    unchanged: { fg: 'white' },
    lineNumber: { fg: 'gray' },
    header: { fg: 'blueBright', bold: true },
    syntax: {
      keyword: { fg: 'red' },
      string: { fg: 'blue' },
      number: { fg: 'blue' },
      comment: { fg: 'gray', italic: true },
      operator: { fg: 'red' },
      punctuation: { fg: 'white' },
      function: { fg: 'magenta' },
      variable: { fg: 'white' },
      type: { fg: 'cyan' },
      property: { fg: 'blue' },
      constant: { fg: 'blue', bold: true },
      tag: { fg: 'green' },
      attribute: { fg: 'blue' },
      text: {}
    }
  }
};

export const monokaiTheme: Theme = {
  name: 'monokai',
  colors: {
    added: { fg: 'green' },
    removed: { fg: 'red' },
    unchanged: { fg: 'white' },
    lineNumber: { fg: 'gray', dim: true },
    header: { fg: 'yellow', bold: true },
    syntax: {
      keyword: { fg: 'red' },
      string: { fg: 'yellow' },
      number: { fg: 'magenta' },
      comment: { fg: 'gray', italic: true },
      operator: { fg: 'red' },
      punctuation: { fg: 'white' },
      function: { fg: 'green' },
      variable: { fg: 'white' },
      type: { fg: 'cyan', italic: true },
      property: { fg: 'white' },
      constant: { fg: 'magenta' },
      tag: { fg: 'red' },
      attribute: { fg: 'green' },
      text: {}
    }
  }
};

export const draculaTheme: Theme = {
  name: 'dracula',
  colors: {
    added: { fg: 'greenBright' },
    removed: { fg: 'redBright' },
    unchanged: { fg: 'white' },
    lineNumber: { fg: 'gray' },
    header: { fg: 'magentaBright', bold: true },
    syntax: {
      keyword: { fg: 'magenta' },
      string: { fg: 'yellow' },
      number: { fg: 'magenta' },
      comment: { fg: 'gray', italic: true },
      operator: { fg: 'magenta' },
      punctuation: { fg: 'white' },
      function: { fg: 'green' },
      variable: { fg: 'white' },
      type: { fg: 'cyan', italic: true },
      property: { fg: 'cyan' },
      constant: { fg: 'magenta' },
      tag: { fg: 'magenta' },
      attribute: { fg: 'green' },
      text: {}
    }
  }
};

export const nordTheme: Theme = {
  name: 'nord',
  colors: {
    added: { fg: 'green' },
    removed: { fg: 'red' },
    unchanged: { fg: 'white' },
    lineNumber: { fg: 'gray', dim: true },
    header: { fg: 'cyanBright', bold: true },
    syntax: {
      keyword: { fg: 'blue' },
      string: { fg: 'green' },
      number: { fg: 'magenta' },
      comment: { fg: 'gray', italic: true },
      operator: { fg: 'cyan' },
      punctuation: { fg: 'white' },
      function: { fg: 'cyan' },
      variable: { fg: 'white' },
      type: { fg: 'yellow' },
      property: { fg: 'cyan' },
      constant: { fg: 'yellow' },
      tag: { fg: 'blue' },
      attribute: { fg: 'cyan' },
      text: {}
    }
  }
};

export const minimalTheme: Theme = {
  name: 'minimal',
  colors: {
    added: { fg: 'green' },
    removed: { fg: 'red' },
    unchanged: {},
    lineNumber: { dim: true },
    header: { bold: true },
    syntax: {
      keyword: {},
      string: {},
      number: {},
      comment: { dim: true },
      operator: {},
      punctuation: {},
      function: {},
      variable: {},
      type: {},
      property: {},
      constant: {},
      tag: {},
      attribute: {},
      text: {}
    }
  }
};

export const themes: Record<string, Theme> = {
  default: defaultTheme,
  github: githubTheme,
  monokai: monokaiTheme,
  dracula: draculaTheme,
  nord: nordTheme,
  minimal: minimalTheme
};

export function getTheme(nameOrTheme: string | Theme): Theme {
  if (typeof nameOrTheme === 'string') {
    return themes[nameOrTheme] || defaultTheme;
  }
  return nameOrTheme;
}

export function createTheme(name: string, colors: PartialThemeColors): Theme {
  return {
    name,
    colors: {
      ...defaultTheme.colors,
      ...colors,
      syntax: {
        ...defaultTheme.colors.syntax,
        ...(colors.syntax || {})
      }
    }
  };
}
