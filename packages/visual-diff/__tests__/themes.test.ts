import {
  createTheme,
  defaultTheme,
  draculaTheme,
  getTheme,
  githubTheme,
  minimalTheme,
  monokaiTheme,
  nordTheme,
  themes} from '../src/themes';

describe('themes', () => {
  describe('built-in themes', () => {
    it('should export default theme', () => {
      expect(defaultTheme).toBeDefined();
      expect(defaultTheme.name).toBe('default');
      expect(defaultTheme.colors).toBeDefined();
    });

    it('should export github theme', () => {
      expect(githubTheme).toBeDefined();
      expect(githubTheme.name).toBe('github');
    });

    it('should export monokai theme', () => {
      expect(monokaiTheme).toBeDefined();
      expect(monokaiTheme.name).toBe('monokai');
    });

    it('should export dracula theme', () => {
      expect(draculaTheme).toBeDefined();
      expect(draculaTheme.name).toBe('dracula');
    });

    it('should export nord theme', () => {
      expect(nordTheme).toBeDefined();
      expect(nordTheme.name).toBe('nord');
    });

    it('should export minimal theme', () => {
      expect(minimalTheme).toBeDefined();
      expect(minimalTheme.name).toBe('minimal');
    });

    it('should have all themes in themes object', () => {
      expect(themes.default).toBe(defaultTheme);
      expect(themes.github).toBe(githubTheme);
      expect(themes.monokai).toBe(monokaiTheme);
      expect(themes.dracula).toBe(draculaTheme);
      expect(themes.nord).toBe(nordTheme);
      expect(themes.minimal).toBe(minimalTheme);
    });
  });

  describe('theme structure', () => {
    const allThemes = [defaultTheme, githubTheme, monokaiTheme, draculaTheme, nordTheme, minimalTheme];

    it.each(allThemes)('$name theme should have required color properties', (theme) => {
      expect(theme.colors.added).toBeDefined();
      expect(theme.colors.removed).toBeDefined();
      expect(theme.colors.unchanged).toBeDefined();
      expect(theme.colors.lineNumber).toBeDefined();
      expect(theme.colors.header).toBeDefined();
      expect(theme.colors.syntax).toBeDefined();
    });

    it.each(allThemes)('$name theme should have syntax colors', (theme) => {
      const syntax = theme.colors.syntax;
      expect(syntax.keyword).toBeDefined();
      expect(syntax.string).toBeDefined();
      expect(syntax.number).toBeDefined();
      expect(syntax.comment).toBeDefined();
      expect(syntax.operator).toBeDefined();
      expect(syntax.punctuation).toBeDefined();
      expect(syntax.function).toBeDefined();
      expect(syntax.variable).toBeDefined();
      expect(syntax.type).toBeDefined();
      expect(syntax.property).toBeDefined();
      expect(syntax.constant).toBeDefined();
      expect(syntax.tag).toBeDefined();
      expect(syntax.attribute).toBeDefined();
      expect(syntax.text).toBeDefined();
    });
  });

  describe('getTheme', () => {
    it('should return theme by name', () => {
      expect(getTheme('default')).toBe(defaultTheme);
      expect(getTheme('github')).toBe(githubTheme);
      expect(getTheme('monokai')).toBe(monokaiTheme);
      expect(getTheme('dracula')).toBe(draculaTheme);
      expect(getTheme('nord')).toBe(nordTheme);
      expect(getTheme('minimal')).toBe(minimalTheme);
    });

    it('should return default theme for unknown name', () => {
      expect(getTheme('unknown')).toBe(defaultTheme);
      expect(getTheme('')).toBe(defaultTheme);
    });

    it('should return theme object directly if passed', () => {
      const customTheme = { ...defaultTheme, name: 'custom' };
      expect(getTheme(customTheme)).toBe(customTheme);
    });
  });

  describe('createTheme', () => {
    it('should create theme with custom name', () => {
      const theme = createTheme('custom', {});
      expect(theme.name).toBe('custom');
    });

    it('should merge with default theme colors', () => {
      const theme = createTheme('custom', {
        added: { fg: 'cyan' }
      });

      expect(theme.colors.added.fg).toBe('cyan');
      expect(theme.colors.removed).toEqual(defaultTheme.colors.removed);
      expect(theme.colors.unchanged).toEqual(defaultTheme.colors.unchanged);
    });

    it('should merge syntax colors', () => {
      const theme = createTheme('custom', {
        syntax: {
          keyword: { fg: 'red', bold: true }
        }
      });

      expect(theme.colors.syntax.keyword).toEqual({ fg: 'red', bold: true });
      expect(theme.colors.syntax.string).toEqual(defaultTheme.colors.syntax.string);
    });

    it('should allow overriding all properties', () => {
      const theme = createTheme('custom', {
        added: { fg: 'blue', bg: 'bgWhite', bold: true },
        removed: { fg: 'yellow', italic: true },
        unchanged: { dim: true },
        lineNumber: { fg: 'magenta' },
        header: { fg: 'cyan', bold: true }
      });

      expect(theme.colors.added.fg).toBe('blue');
      expect(theme.colors.added.bg).toBe('bgWhite');
      expect(theme.colors.added.bold).toBe(true);
      expect(theme.colors.removed.fg).toBe('yellow');
      expect(theme.colors.removed.italic).toBe(true);
      expect(theme.colors.unchanged.dim).toBe(true);
      expect(theme.colors.lineNumber.fg).toBe('magenta');
      expect(theme.colors.header.fg).toBe('cyan');
    });
  });
});
