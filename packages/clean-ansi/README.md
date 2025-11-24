# clean-ansi 🧹

<p align="center">
  <img src="https://raw.githubusercontent.com/hyperweb-io/dev-utils/refs/heads/main/docs/img/logo.svg" width="80">
  <br />
    <strong>strip ANSI escape codes from strings</strong>
  <br />
  <br />
  Remove all ANSI escape codes from terminal output
  <br />
  <br />
  <a href="https://github.com/hyperweb-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/hyperweb-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/hyperweb-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
</p>

## Why clean-ansi?

Terminal output often contains ANSI escape codes for colors, cursor movement, and formatting. `clean-ansi` removes these codes to give you clean, plain text that's perfect for:

- 🧪 Testing terminal applications and comparing output
- 📝 Logging to files without formatting codes
- 🔍 Parsing command-line tool output
- 📊 Processing terminal data for analysis

## Install

```sh
npm install clean-ansi
```

## Usage

```typescript
import { cleanAnsi } from 'clean-ansi';

const coloredText = '\u001b[31mRed text\u001b[0m';
const cleanText = cleanAnsi(coloredText);
console.log(cleanText); // 'Red text'
```

## API

### `cleanAnsi(input: string): string`

Removes all ANSI escape codes from the input string.

**Parameters:**
- `input` - The string containing ANSI escape codes

**Returns:**
- A string with all ANSI escape codes removed

**Handles:**
- CSI sequences (color codes, cursor movement, etc.)
- OSC sequences (OS commands like window title)
- Other escape sequences

### `stripAnsi(input: string): string`

Alias for `cleanAnsi` for compatibility.

## Examples

```typescript
import { cleanAnsi } from 'clean-ansi';

// Remove color codes
cleanAnsi('\u001b[31mRed\u001b[0m \u001b[32mGreen\u001b[0m');
// Returns: 'Red Green'

// Remove cursor movement codes
cleanAnsi('Hello\u001b[AWorld');
// Returns: 'HelloWorld'

// Handle complex terminal output
cleanAnsi('\u001b[?25l\u001b[2J\u001b[H\u001b[31mError:\u001b[0m Message\u001b[?25h');
// Returns: 'Error: Message'

// Preserve newlines and whitespace
cleanAnsi('\u001b[31mLine 1\u001b[0m\nLine 2');
// Returns: 'Line 1\nLine 2'
```

## Design Philosophy

clean-ansi embraces simplicity:
- 🎯 Zero dependencies
- 🪶 Tiny footprint
- 🚀 Fast and predictable
- 💎 Pure function
- 📖 Clear, focused API
