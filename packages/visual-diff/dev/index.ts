import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

import {
  diffFiles,
  renderTerminal,
  renderHtmlDocument,
  themes
} from '../src';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const OUT_DIR = path.join(__dirname, '..', 'out');

interface Fixture {
  name: string;
  oldFile: string;
  newFile: string;
  language: string;
}

const fixtures: Fixture[] = [
  {
    name: 'TypeScript',
    oldFile: 'typescript-old.ts',
    newFile: 'typescript-new.ts',
    language: 'typescript'
  },
  {
    name: 'SQL',
    oldFile: 'sql-old.sql',
    newFile: 'sql-new.sql',
    language: 'sql'
  },
  {
    name: 'Python',
    oldFile: 'python-old.py',
    newFile: 'python-new.py',
    language: 'python'
  }
];

function loadFixture(fixture: Fixture) {
  const oldPath = path.join(FIXTURES_DIR, fixture.oldFile);
  const newPath = path.join(FIXTURES_DIR, fixture.newFile);
  const oldContent = fs.readFileSync(oldPath, 'utf-8');
  const newContent = fs.readFileSync(newPath, 'utf-8');
  return { oldContent, newContent };
}

function printTerminalPreview() {
  console.log('\n' + '='.repeat(80));
  console.log('  VISUAL-DIFF TERMINAL PREVIEW');
  console.log('='.repeat(80) + '\n');

  const themeNames = Object.keys(themes);

  for (const fixture of fixtures) {
    const { oldContent, newContent } = loadFixture(fixture);
    const result = diffFiles(oldContent, newContent, fixture.oldFile, fixture.newFile);

    console.log('\n' + '-'.repeat(80));
    console.log(`  ${fixture.name} Diff`);
    console.log('-'.repeat(80));

    for (const themeName of themeNames) {
      console.log(`\n>>> Theme: ${themeName}\n`);
      const output = renderTerminal(result, {
        theme: themeName,
        showLineNumbers: true,
        syntaxHighlight: true
      });
      console.log(output);
      console.log('');
    }
  }
}

function generateHtmlPreview(): string {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const htmlParts: string[] = [];

  htmlParts.push(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual Diff Preview</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      background: #0d1117;
      color: #c9d1d9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { text-align: center; margin-bottom: 40px; }
    h2 { margin-top: 40px; border-bottom: 1px solid #30363d; padding-bottom: 10px; }
    h3 { color: #8b949e; margin-top: 30px; }
    .theme-section { margin-bottom: 30px; }
    .diff-container { margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>@constructive-io/visual-diff Preview</h1>
`);

  const themeNames = Object.keys(themes);

  for (const fixture of fixtures) {
    const { oldContent, newContent } = loadFixture(fixture);
    const result = diffFiles(oldContent, newContent, fixture.oldFile, fixture.newFile);

    htmlParts.push(`    <h2>${fixture.name} Diff</h2>\n`);

    for (const themeName of themeNames) {
      htmlParts.push(`    <div class="theme-section">\n`);
      htmlParts.push(`      <h3>Theme: ${themeName}</h3>\n`);
      htmlParts.push(`      <div class="diff-container">\n`);

      const html = renderHtmlDocument(result, {
        theme: themeName,
        darkMode: true,
        syntaxHighlight: true
      });

      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch) {
        htmlParts.push(bodyMatch[1]);
      }

      htmlParts.push(`      </div>\n`);
      htmlParts.push(`    </div>\n`);
    }
  }

  htmlParts.push(`  </div>
</body>
</html>`);

  const fullHtml = htmlParts.join('');
  const outputPath = path.join(OUT_DIR, 'preview.html');
  fs.writeFileSync(outputPath, fullHtml);

  return outputPath;
}

function startServer(htmlPath: string, port: number) {
  const html = fs.readFileSync(htmlPath, 'utf-8');

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });

  server.listen(port, () => {
    console.log(`\nServer running at http://localhost:${port}`);
    console.log('Press Ctrl+C to stop\n');
  });
}

function printUsage() {
  console.log(`
Usage: pnpm dev [options]

Options:
  --terminal    Show terminal preview with all themes
  --html        Generate HTML preview file
  --serve       Start HTTP server to view HTML preview
  --port=PORT   Port for HTTP server (default: 3456)
  --help        Show this help message

Examples:
  pnpm dev --terminal          # Show terminal output
  pnpm dev --html              # Generate out/preview.html
  pnpm dev --html --serve      # Generate and serve HTML
  pnpm dev                     # Show terminal + generate HTML
`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    printUsage();
    return;
  }

  const showTerminal = args.includes('--terminal') || args.length === 0;
  const generateHtml = args.includes('--html') || args.length === 0;
  const serve = args.includes('--serve');
  const portArg = args.find(a => a.startsWith('--port='));
  const port = portArg ? parseInt(portArg.split('=')[1], 10) : 3456;

  if (showTerminal) {
    printTerminalPreview();
  }

  if (generateHtml || serve) {
    const htmlPath = generateHtmlPreview();
    console.log(`\nHTML preview generated: ${htmlPath}`);

    if (serve) {
      startServer(htmlPath, port);
    } else {
      console.log('Open this file in your browser to view the preview.\n');
    }
  }
}

main();
