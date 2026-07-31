import { detectLanguage, highlightLine,tokenize } from '../src/highlight';

describe('detectLanguage', () => {
  it('should detect JavaScript files', () => {
    expect(detectLanguage('file.js')).toBe('javascript');
    expect(detectLanguage('file.mjs')).toBe('javascript');
    expect(detectLanguage('file.cjs')).toBe('javascript');
    expect(detectLanguage('file.jsx')).toBe('javascript');
  });

  it('should detect TypeScript files', () => {
    expect(detectLanguage('file.ts')).toBe('typescript');
    expect(detectLanguage('file.tsx')).toBe('typescript');
    expect(detectLanguage('file.mts')).toBe('typescript');
  });

  it('should detect Python files', () => {
    expect(detectLanguage('file.py')).toBe('python');
    expect(detectLanguage('file.pyw')).toBe('python');
  });

  it('should detect JSON files', () => {
    expect(detectLanguage('file.json')).toBe('json');
    expect(detectLanguage('file.jsonc')).toBe('json');
  });

  it('should detect HTML files', () => {
    expect(detectLanguage('file.html')).toBe('html');
    expect(detectLanguage('file.htm')).toBe('html');
    expect(detectLanguage('file.xml')).toBe('html');
    expect(detectLanguage('file.svg')).toBe('html');
  });

  it('should detect CSS files', () => {
    expect(detectLanguage('file.css')).toBe('css');
    expect(detectLanguage('file.scss')).toBe('css');
    expect(detectLanguage('file.sass')).toBe('css');
    expect(detectLanguage('file.less')).toBe('css');
  });

  it('should detect SQL files', () => {
    expect(detectLanguage('file.sql')).toBe('sql');
    expect(detectLanguage('file.pgsql')).toBe('sql');
  });

  it('should detect YAML files', () => {
    expect(detectLanguage('file.yaml')).toBe('yaml');
    expect(detectLanguage('file.yml')).toBe('yaml');
  });

  it('should detect Markdown files', () => {
    expect(detectLanguage('file.md')).toBe('markdown');
    expect(detectLanguage('file.markdown')).toBe('markdown');
  });

  it('should detect Go files', () => {
    expect(detectLanguage('file.go')).toBe('go');
  });

  it('should detect Rust files', () => {
    expect(detectLanguage('file.rs')).toBe('rust');
  });

  it('should detect Java files', () => {
    expect(detectLanguage('file.java')).toBe('java');
  });

  it('should detect C files', () => {
    expect(detectLanguage('file.c')).toBe('c');
    expect(detectLanguage('file.h')).toBe('c');
  });

  it('should detect C++ files', () => {
    expect(detectLanguage('file.cpp')).toBe('cpp');
    expect(detectLanguage('file.cc')).toBe('cpp');
    expect(detectLanguage('file.hpp')).toBe('cpp');
  });

  it('should detect shell files', () => {
    expect(detectLanguage('file.sh')).toBe('shell');
    expect(detectLanguage('file.bash')).toBe('shell');
    expect(detectLanguage('file.zsh')).toBe('shell');
  });

  it('should return plaintext for unknown extensions', () => {
    expect(detectLanguage('file.xyz')).toBe('plaintext');
    expect(detectLanguage('file.unknown')).toBe('plaintext');
    expect(detectLanguage('noextension')).toBe('plaintext');
  });

  it('should handle case insensitivity', () => {
    expect(detectLanguage('file.JS')).toBe('javascript');
    expect(detectLanguage('file.TS')).toBe('typescript');
    expect(detectLanguage('file.PY')).toBe('python');
  });
});

describe('tokenize', () => {
  describe('JavaScript', () => {
    it('should tokenize keywords', () => {
      const tokens = tokenize('const x = 1;', 'javascript');
      const keywordToken = tokens.find(t => t.type === 'keyword');
      expect(keywordToken).toBeDefined();
      expect(keywordToken?.value).toBe('const');
    });

    it('should tokenize strings', () => {
      const tokens = tokenize('const s = "hello";', 'javascript');
      const stringToken = tokens.find(t => t.type === 'string');
      expect(stringToken).toBeDefined();
      expect(stringToken?.value).toBe('"hello"');
    });

    it('should tokenize numbers', () => {
      const tokens = tokenize('const n = 42;', 'javascript');
      const numberToken = tokens.find(t => t.type === 'number');
      expect(numberToken).toBeDefined();
      expect(numberToken?.value).toBe('42');
    });

    it('should tokenize comments', () => {
      const tokens = tokenize('// this is a comment', 'javascript');
      const commentToken = tokens.find(t => t.type === 'comment');
      expect(commentToken).toBeDefined();
      expect(commentToken?.value).toContain('// this is a comment');
    });

    it('should tokenize function calls', () => {
      const tokens = tokenize('console.log("test")', 'javascript');
      const functionToken = tokens.find(t => t.type === 'function');
      expect(functionToken).toBeDefined();
    });
  });

  describe('TypeScript', () => {
    it('should tokenize type keywords', () => {
      const tokens = tokenize('interface User { name: string }', 'typescript');
      const keywordToken = tokens.find(t => t.type === 'keyword' && t.value === 'interface');
      expect(keywordToken).toBeDefined();
    });

    it('should tokenize type annotations', () => {
      const tokens = tokenize('const x: number = 1;', 'typescript');
      const keywordTokens = tokens.filter(t => t.type === 'keyword');
      expect(keywordTokens.some(t => t.value === 'const')).toBe(true);
    });
  });

  describe('Python', () => {
    it('should tokenize Python keywords', () => {
      const tokens = tokenize('def hello():', 'python');
      const keywordToken = tokens.find(t => t.type === 'keyword');
      expect(keywordToken).toBeDefined();
      expect(keywordToken?.value).toBe('def');
    });

    it('should tokenize Python comments', () => {
      const tokens = tokenize('# comment', 'python');
      const commentToken = tokens.find(t => t.type === 'comment');
      expect(commentToken).toBeDefined();
    });

    it('should tokenize Python constants', () => {
      const tokens = tokenize('x = True', 'python');
      const constantToken = tokens.find(t => t.type === 'constant');
      expect(constantToken).toBeDefined();
      expect(constantToken?.value).toBe('True');
    });
  });

  describe('JSON', () => {
    it('should tokenize JSON strings', () => {
      const tokens = tokenize('{"key": "value"}', 'json');
      const stringTokens = tokens.filter(t => t.type === 'string');
      expect(stringTokens.length).toBeGreaterThan(0);
    });

    it('should tokenize JSON booleans', () => {
      const tokens = tokenize('{"active": true}', 'json');
      const constantToken = tokens.find(t => t.type === 'constant');
      expect(constantToken).toBeDefined();
      expect(constantToken?.value).toBe('true');
    });

    it('should tokenize JSON numbers', () => {
      const tokens = tokenize('{"count": 42}', 'json');
      const numberToken = tokens.find(t => t.type === 'number');
      expect(numberToken).toBeDefined();
      expect(numberToken?.value).toBe('42');
    });
  });

  describe('SQL', () => {
    it('should tokenize SQL keywords', () => {
      const tokens = tokenize('SELECT * FROM users', 'sql');
      const keywordTokens = tokens.filter(t => t.type === 'keyword');
      expect(keywordTokens.some(t => t.value === 'SELECT')).toBe(true);
      expect(keywordTokens.some(t => t.value === 'FROM')).toBe(true);
    });

    it('should tokenize SQL strings', () => {
      const tokens = tokenize("WHERE name = 'John'", 'sql');
      const stringToken = tokens.find(t => t.type === 'string');
      expect(stringToken).toBeDefined();
    });
  });

  describe('plaintext', () => {
    it('should return single text token for plaintext', () => {
      const tokens = tokenize('just some text', 'plaintext');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('text');
      expect(tokens[0].value).toBe('just some text');
    });
  });
});

describe('highlightLine', () => {
  it('should return tokens for a line of code', () => {
    const tokens = highlightLine('const x = 1;', 'javascript');
    expect(tokens.length).toBeGreaterThan(0);
  });

  it('should handle empty lines', () => {
    const tokens = highlightLine('', 'javascript');
    expect(tokens).toHaveLength(0);
  });

  it('should handle whitespace-only lines', () => {
    const tokens = highlightLine('   ', 'javascript');
    expect(tokens.length).toBeGreaterThanOrEqual(0);
  });
});
