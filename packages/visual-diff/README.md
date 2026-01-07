# @interweb/visual-diff

<p align="center">
  <img src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" height="250">
  <br />
    <strong>beautiful visual diff</strong>
  <br />
  <br />
  Syntax highlighting for terminal and HTML output
  <br />
  <br />
  <a href="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/constructive-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
</p>

Beautiful visual diff with syntax highlighting for terminal and HTML output.

## Features

- Line-by-line diff computation with LCS algorithm
- Syntax highlighting for 15+ languages (JavaScript, TypeScript, Python, SQL, Go, Rust, and more)
- Beautiful terminal output with ANSI colors
- HTML output with dark/light mode support
- 6 built-in themes (default, github, monokai, dracula, nord, minimal)
- Customizable themes and styling
- Side-by-side and unified diff views
- Parse and create unified diff format

## Installation

```bash
npm install @interweb/visual-diff
# or
pnpm add @interweb/visual-diff
# or
yarn add @interweb/visual-diff
```

## Quick Start

```typescript
import { diff, renderTerminal, renderHtml } from '@interweb/visual-diff';

const oldCode = `function hello() {
  console.log("Hello");
}`;

const newCode = `function hello() {
  console.log("Hello, World!");
}`;

// Compute the diff
const result = diff(oldCode, newCode);

// Render to terminal with syntax highlighting
console.log(renderTerminal(result, { 
  language: 'javascript',
  theme: 'dracula'
}));

// Render to HTML
const html = renderHtml(result, {
  language: 'javascript',
  darkMode: true
});
```

## API

### Diff Functions

#### `diff(oldContent, newContent, options?)`

Computes the diff between two strings.

```typescript
const result = diff(oldContent, newContent, {
  context: 3,           // Number of context lines (default: 3)
  ignoreWhitespace: false,  // Ignore whitespace differences
  ignoreCase: false     // Ignore case differences
});
```

#### `diffFiles(oldContent, newContent, oldFile, newFile, options?)`

Computes diff with file metadata and auto-detected language.

```typescript
const result = diffFiles(
  oldContent,
  newContent,
  'src/old.ts',
  'src/new.ts'
);
// result.language will be 'typescript'
```

### Render Functions

#### `renderTerminal(result, options?)`

Renders diff to terminal with ANSI colors.

```typescript
const output = renderTerminal(result, {
  theme: 'github',        // Theme name or custom theme
  showLineNumbers: true,  // Show line numbers
  syntaxHighlight: true,  // Enable syntax highlighting
  language: 'typescript', // Override language detection
  colorize: true          // Enable ANSI colors
});
```

#### `renderHtml(result, options?)`

Renders diff to HTML.

```typescript
const html = renderHtml(result, {
  theme: 'monokai',
  darkMode: true,
  className: 'my-diff',
  inlineStyles: true,
  syntaxHighlight: true
});
```

#### `renderHtmlDocument(result, options?)`

Renders a complete HTML document with the diff.

#### `renderHtmlSideBySide(result, options?)`

Renders diff in side-by-side layout.

### Themes

Built-in themes:
- `default` - Clean default theme
- `github` - GitHub-style colors
- `monokai` - Monokai editor theme
- `dracula` - Dracula theme
- `nord` - Nord color palette
- `minimal` - Minimal styling

#### Custom Themes

```typescript
import { createTheme } from '@interweb/visual-diff';

const myTheme = createTheme('custom', {
  added: { fg: 'cyan', bold: true },
  removed: { fg: 'yellow' },
  syntax: {
    keyword: { fg: 'magenta', bold: true },
    string: { fg: 'green' }
  }
});

renderTerminal(result, { theme: myTheme });
```

### Syntax Highlighting

Supported languages:
- JavaScript / TypeScript
- Python
- JSON
- HTML / XML
- CSS / SCSS
- SQL
- YAML
- Markdown
- Go
- Rust
- Java
- C / C++
- Shell / Bash

#### Language Detection

```typescript
import { detectLanguage } from '@interweb/visual-diff';

detectLanguage('file.ts');  // 'typescript'
detectLanguage('file.py');  // 'python'
detectLanguage('file.sql'); // 'sql'
```

### Unified Diff Format

```typescript
import { createUnifiedDiff, parseUnifiedDiff } from '@interweb/visual-diff';

// Create unified diff string
const unified = createUnifiedDiff(result);

// Parse unified diff string
const parsed = parseUnifiedDiff(unifiedDiffString);
```

### Utilities

```typescript
import { hasDifferences, countChanges } from '@interweb/visual-diff';

// Check if there are any differences
if (hasDifferences(result)) {
  // Get counts
  const { additions, deletions } = countChanges(result);
  console.log(`+${additions} -${deletions}`);
}
```

## License

MIT
