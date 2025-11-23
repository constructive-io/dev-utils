import fs from 'node:fs/promises';
import path from 'node:path';

interface ReadmeFooterArgs {
  source: string;
  footer: string;
  dest: string;
}

export async function runReadmeFooter(args: string[]) {
  const parsed = parseArgs(args);

  const [readme, footer] = await Promise.all([
    fs.readFile(parsed.source, 'utf8'),
    fs.readFile(parsed.footer, 'utf8')
  ]);

  const combined = `${readme.trimEnd()}\n\n---\n\n${footer.trim()}\n`;
  const destDir = path.dirname(parsed.dest);
  await fs.mkdir(destDir, { recursive: true });
  await fs.writeFile(parsed.dest, combined, 'utf8');

  console.log(
    `[makage] wrote README with footer: ${parsed.source} + ${parsed.footer} -> ${parsed.dest}`
  );
}

function parseArgs(args: string[]): ReadmeFooterArgs {
  const out: Partial<ReadmeFooterArgs> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--source') out.source = args[++i];
    else if (a === '--footer') out.footer = args[++i];
    else if (a === '--dest') out.dest = args[++i];
  }

  if (!out.source || !out.footer || !out.dest) {
    throw new Error(
      'readme-footer requires --source <file> --footer <file> --dest <file>'
    );
  }

  return out as ReadmeFooterArgs;
}
