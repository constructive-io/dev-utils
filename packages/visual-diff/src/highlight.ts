import type { Language, SyntaxToken, TokenType } from './types';

interface TokenPattern {
  type: TokenType;
  pattern: RegExp;
}

const createPatterns = (patterns: Array<[TokenType, string]>): TokenPattern[] =>
  patterns.map(([type, pattern]) => ({
    type,
    pattern: new RegExp(pattern, 'g')
  }));

const javascriptPatterns = createPatterns([
  ['comment', '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/'],
  ['string', '`[^`]*`|"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\''],
  ['keyword', '\\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|yield|static|get|set|super)\\b'],
  ['constant', '\\b(true|false|null|undefined|NaN|Infinity)\\b'],
  ['number', '\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?\\b|0x[0-9a-fA-F]+\\b'],
  ['function', '\\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\\s*\\()'],
  ['type', '\\b[A-Z][a-zA-Z0-9_$]*\\b'],
  ['operator', '=>|\\.\\.\\.|[+\\-*/%=<>!&|^~?:]+'],
  ['punctuation', '[{}\\[\\]();,.]']
]);

const typescriptPatterns = createPatterns([
  ['comment', '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/'],
  ['string', '`[^`]*`|"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\''],
  ['keyword', '\\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|yield|static|get|set|super|type|interface|enum|namespace|module|declare|abstract|implements|private|protected|public|readonly|as|is|keyof|infer|never|unknown|any)\\b'],
  ['constant', '\\b(true|false|null|undefined|NaN|Infinity)\\b'],
  ['number', '\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?\\b|0x[0-9a-fA-F]+\\b'],
  ['function', '\\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\\s*[<(])'],
  ['type', '\\b[A-Z][a-zA-Z0-9_$]*\\b'],
  ['operator', '=>|\\.\\.\\.|[+\\-*/%=<>!&|^~?:]+'],
  ['punctuation', '[{}\\[\\]();,.<>]']
]);

const pythonPatterns = createPatterns([
  ['comment', '#[^\\n]*'],
  ['string', '"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'|"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\''],
  ['keyword', '\\b(def|class|if|elif|else|for|while|try|except|finally|with|as|import|from|return|yield|raise|pass|break|continue|and|or|not|in|is|lambda|global|nonlocal|assert|async|await)\\b'],
  ['constant', '\\b(True|False|None)\\b'],
  ['number', '\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?j?\\b|0x[0-9a-fA-F]+\\b|0o[0-7]+\\b|0b[01]+\\b'],
  ['function', '\\b[a-zA-Z_][a-zA-Z0-9_]*(?=\\s*\\()'],
  ['type', '\\b[A-Z][a-zA-Z0-9_]*\\b'],
  ['operator', '->|\\*\\*|//|[+\\-*/%=<>!&|^~@:]+'],
  ['punctuation', '[{}\\[\\]();,.]']
]);

const jsonPatterns = createPatterns([
  ['string', '"(?:[^"\\\\]|\\\\.)*"'],
  ['number', '-?\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?\\b'],
  ['constant', '\\b(true|false|null)\\b'],
  ['punctuation', '[{}\\[\\]:,]']
]);

const htmlPatterns = createPatterns([
  ['comment', '<!--[\\s\\S]*?-->'],
  ['tag', '<\\/?[a-zA-Z][a-zA-Z0-9-]*|\\/?\\s*>'],
  ['attribute', '\\b[a-zA-Z][a-zA-Z0-9-]*(?=\\s*=)'],
  ['string', '"[^"]*"|\'[^\']*\''],
  ['operator', '='],
  ['punctuation', '[<>/]']
]);

const cssPatterns = createPatterns([
  ['comment', '\\/\\*[\\s\\S]*?\\*\\/'],
  ['string', '"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\''],
  ['keyword', '@[a-zA-Z][a-zA-Z0-9-]*'],
  ['property', '[a-zA-Z-]+(?=\\s*:)'],
  ['number', '-?\\d+(\\.\\d+)?(px|em|rem|%|vh|vw|deg|s|ms)?\\b'],
  ['constant', '#[0-9a-fA-F]{3,8}\\b'],
  ['function', '[a-zA-Z-]+(?=\\s*\\()'],
  ['punctuation', '[{}();:,.]']
]);

const sqlPatterns = createPatterns([
  ['comment', '--[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/'],
  ['string', '\'(?:[^\'\\\\]|\\\\.)*\'|"(?:[^"\\\\]|\\\\.)*"'],
  ['keyword', '\\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|IS|NULL|AS|ON|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|UNION|ALL|DISTINCT|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|VIEW|DROP|ALTER|ADD|COLUMN|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|DEFAULT|CHECK|UNIQUE|CASCADE|TRUNCATE|BEGIN|COMMIT|ROLLBACK|TRANSACTION|GRANT|REVOKE|WITH|CASE|WHEN|THEN|ELSE|END|LIKE|BETWEEN|EXISTS|ANY|SOME|COALESCE|NULLIF|CAST|CONVERT)\\b'],
  ['function', '\\b(COUNT|SUM|AVG|MIN|MAX|COALESCE|NULLIF|CAST|CONVERT|UPPER|LOWER|TRIM|SUBSTRING|LENGTH|CONCAT|NOW|DATE|TIME|TIMESTAMP|EXTRACT|ROUND|FLOOR|CEIL|ABS|MOD|POWER|SQRT)\\b(?=\\s*\\()'],
  ['type', '\\b(INT|INTEGER|BIGINT|SMALLINT|TINYINT|DECIMAL|NUMERIC|FLOAT|REAL|DOUBLE|CHAR|VARCHAR|TEXT|BLOB|BOOLEAN|DATE|TIME|TIMESTAMP|DATETIME|JSON|JSONB|UUID|SERIAL|BIGSERIAL)\\b'],
  ['number', '\\b\\d+(\\.\\d+)?\\b'],
  ['operator', '[+\\-*/%=<>!&|^~]+|::|\\|\\|'],
  ['punctuation', '[();,.]']
]);

const yamlPatterns = createPatterns([
  ['comment', '#[^\\n]*'],
  ['string', '"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\''],
  ['property', '^\\s*[a-zA-Z_][a-zA-Z0-9_-]*(?=\\s*:)'],
  ['constant', '\\b(true|false|null|yes|no|on|off)\\b'],
  ['number', '\\b\\d+(\\.\\d+)?\\b'],
  ['operator', '[:|>\\-]'],
  ['punctuation', '[\\[\\]{},]']
]);

const markdownPatterns = createPatterns([
  ['keyword', '^#{1,6}\\s.*$'],
  ['string', '`[^`]+`|```[\\s\\S]*?```'],
  ['constant', '\\*\\*[^*]+\\*\\*|__[^_]+__'],
  ['variable', '\\*[^*]+\\*|_[^_]+_'],
  ['function', '\\[[^\\]]+\\]\\([^)]+\\)'],
  ['punctuation', '[*_`#\\[\\]()>-]']
]);

const goPatterns = createPatterns([
  ['comment', '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/'],
  ['string', '`[^`]*`|"(?:[^"\\\\]|\\\\.)*"'],
  ['keyword', '\\b(break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var)\\b'],
  ['constant', '\\b(true|false|nil|iota)\\b'],
  ['type', '\\b(bool|byte|complex64|complex128|error|float32|float64|int|int8|int16|int32|int64|rune|string|uint|uint8|uint16|uint32|uint64|uintptr)\\b'],
  ['number', '\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?i?\\b|0x[0-9a-fA-F]+\\b'],
  ['function', '\\b[a-zA-Z_][a-zA-Z0-9_]*(?=\\s*\\()'],
  ['operator', ':=|<-|\\.\\.\\.|[+\\-*/%=<>!&|^]+'],
  ['punctuation', '[{}\\[\\]();,.]']
]);

const rustPatterns = createPatterns([
  ['comment', '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/'],
  ['string', '"(?:[^"\\\\]|\\\\.)*"|r#*"[\\s\\S]*?"#*'],
  ['keyword', '\\b(as|async|await|break|const|continue|crate|dyn|else|enum|extern|false|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|true|type|unsafe|use|where|while)\\b'],
  ['constant', '\\b(true|false|None|Some|Ok|Err)\\b'],
  ['type', '\\b[A-Z][a-zA-Z0-9_]*\\b|\\b(i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize|f32|f64|bool|char|str|String|Vec|Option|Result|Box|Rc|Arc|Cell|RefCell)\\b'],
  ['number', '\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?(_[iu]\\d+|_[iu]size|_f\\d+)?\\b|0x[0-9a-fA-F_]+\\b|0o[0-7_]+\\b|0b[01_]+\\b'],
  ['function', '\\b[a-z_][a-zA-Z0-9_]*(?=\\s*[(<])'],
  ['operator', '=>|->|\\.\\.=?|[+\\-*/%=<>!&|^?]+'],
  ['punctuation', '[{}\\[\\]();,.:\'#]']
]);

const javaPatterns = createPatterns([
  ['comment', '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/'],
  ['string', '"(?:[^"\\\\]|\\\\.)*"'],
  ['keyword', '\\b(abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while)\\b'],
  ['constant', '\\b(true|false|null)\\b'],
  ['type', '\\b[A-Z][a-zA-Z0-9_]*\\b'],
  ['number', '\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?[fFdDlL]?\\b|0x[0-9a-fA-F]+[lL]?\\b'],
  ['function', '\\b[a-zA-Z_][a-zA-Z0-9_]*(?=\\s*\\()'],
  ['operator', '->|[+\\-*/%=<>!&|^~?:]+'],
  ['punctuation', '[{}\\[\\]();,.]']
]);

const cPatterns = createPatterns([
  ['comment', '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/'],
  ['string', '"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\''],
  ['keyword', '\\b(auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|inline|int|long|register|restrict|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while|_Alignas|_Alignof|_Atomic|_Bool|_Complex|_Generic|_Imaginary|_Noreturn|_Static_assert|_Thread_local)\\b'],
  ['constant', '\\b(NULL|true|false|TRUE|FALSE)\\b'],
  ['type', '\\b(size_t|ptrdiff_t|intptr_t|uintptr_t|int8_t|int16_t|int32_t|int64_t|uint8_t|uint16_t|uint32_t|uint64_t)\\b'],
  ['number', '\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?[fFlLuU]*\\b|0x[0-9a-fA-F]+[lLuU]*\\b'],
  ['function', '\\b[a-zA-Z_][a-zA-Z0-9_]*(?=\\s*\\()'],
  ['operator', '->|\\+\\+|--|<<|>>|[+\\-*/%=<>!&|^~?:]+'],
  ['punctuation', '[{}\\[\\]();,.]']
]);

const cppPatterns = createPatterns([
  ['comment', '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/'],
  ['string', 'R"[^(]*\\([\\s\\S]*?\\)[^"]*"|"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\''],
  ['keyword', '\\b(alignas|alignof|and|and_eq|asm|auto|bitand|bitor|bool|break|case|catch|char|char8_t|char16_t|char32_t|class|compl|concept|const|consteval|constexpr|constinit|const_cast|continue|co_await|co_return|co_yield|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|false|float|for|friend|goto|if|inline|int|long|mutable|namespace|new|noexcept|not|not_eq|nullptr|operator|or|or_eq|private|protected|public|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|true|try|typedef|typeid|typename|union|unsigned|using|virtual|void|volatile|wchar_t|while|xor|xor_eq)\\b'],
  ['constant', '\\b(nullptr|true|false|NULL)\\b'],
  ['type', '\\b[A-Z][a-zA-Z0-9_]*\\b|\\b(std::[a-zA-Z_][a-zA-Z0-9_]*)\\b'],
  ['number', '\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?[fFlLuU]*\\b|0x[0-9a-fA-F]+[lLuU]*\\b|0b[01]+\\b'],
  ['function', '\\b[a-zA-Z_][a-zA-Z0-9_]*(?=\\s*[<(])'],
  ['operator', '->\\*?|::|\\+\\+|--|<<|>>|<=>|[+\\-*/%=<>!&|^~?:]+'],
  ['punctuation', '[{}\\[\\]();,.<>]']
]);

const shellPatterns = createPatterns([
  ['comment', '#[^\\n]*'],
  ['string', '"(?:[^"\\\\]|\\\\.)*"|\'[^\']*\'|\\$\'(?:[^\'\\\\]|\\\\.)*\''],
  ['keyword', '\\b(if|then|else|elif|fi|case|esac|for|while|until|do|done|in|function|select|time|coproc)\\b'],
  ['variable', '\\$[a-zA-Z_][a-zA-Z0-9_]*|\\$\\{[^}]+\\}|\\$[0-9@#?$!*-]'],
  ['function', '\\b[a-zA-Z_][a-zA-Z0-9_-]*(?=\\s*\\(\\))'],
  ['operator', '\\|\\||&&|;;|[|&;<>]+'],
  ['punctuation', '[{}\\[\\]();]']
]);

const languagePatterns: Record<Language, TokenPattern[]> = {
  javascript: javascriptPatterns,
  typescript: typescriptPatterns,
  python: pythonPatterns,
  json: jsonPatterns,
  html: htmlPatterns,
  css: cssPatterns,
  sql: sqlPatterns,
  yaml: yamlPatterns,
  markdown: markdownPatterns,
  go: goPatterns,
  rust: rustPatterns,
  java: javaPatterns,
  c: cPatterns,
  cpp: cppPatterns,
  shell: shellPatterns,
  plaintext: []
};

const extensionToLanguage: Record<string, Language> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.py': 'python',
  '.pyw': 'python',
  '.json': 'json',
  '.jsonc': 'json',
  '.html': 'html',
  '.htm': 'html',
  '.xml': 'html',
  '.svg': 'html',
  '.css': 'css',
  '.scss': 'css',
  '.sass': 'css',
  '.less': 'css',
  '.sql': 'sql',
  '.pgsql': 'sql',
  '.mysql': 'sql',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hxx': 'cpp',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.fish': 'shell'
};

export function detectLanguage(filename: string): Language {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return extensionToLanguage[ext] || 'plaintext';
}

export function tokenize(code: string, language: Language): SyntaxToken[] {
  const patterns = languagePatterns[language];
  if (!patterns || patterns.length === 0) {
    return [{ type: 'text', value: code }];
  }

  const tokens: SyntaxToken[] = [];
  let remaining = code;
  let position = 0;

  while (remaining.length > 0) {
    let earliestMatch: { index: number; length: number; type: TokenType } | null = null;

    for (const { type, pattern } of patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(remaining);
      if (match && match.index === 0) {
        if (!earliestMatch || match[0].length > earliestMatch.length) {
          earliestMatch = { index: 0, length: match[0].length, type };
        }
      }
    }

    if (earliestMatch && earliestMatch.index === 0) {
      const value = remaining.slice(0, earliestMatch.length);
      tokens.push({ type: earliestMatch.type, value });
      remaining = remaining.slice(earliestMatch.length);
      position += earliestMatch.length;
    } else {
      let nextMatchIndex = remaining.length;
      for (const { pattern } of patterns) {
        pattern.lastIndex = 1;
        const match = pattern.exec(remaining);
        if (match && match.index < nextMatchIndex) {
          nextMatchIndex = match.index;
        }
      }

      const textValue = remaining.slice(0, nextMatchIndex);
      if (textValue) {
        tokens.push({ type: 'text', value: textValue });
      }
      remaining = remaining.slice(nextMatchIndex);
      position += nextMatchIndex;
    }
  }

  return tokens;
}

export function highlightLine(line: string, language: Language): SyntaxToken[] {
  return tokenize(line, language);
}
