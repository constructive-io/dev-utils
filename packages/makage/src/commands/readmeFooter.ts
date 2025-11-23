import fs from 'node:fs/promises';
import path from 'node:path';

interface ReadmeFooterArgs {
  source: string;
  footer: string;
  dest: string;
}

export async function runReadmeFooter(args: string[]) {
  const parsed = parseArgs(args);

  const readme = await fs.readFile(parsed.source, 'utf8');

  let footer: string | null = null;
  try {
    footer = await fs.readFile(parsed.footer, 'utf8');
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      console.log(`[makage] warning: ${parsed.footer} not found, skipping footer`);
    } else {
      throw err;
    }
  }

  const combined = footer
    ? `${readme.trimEnd()}\n\n---\n\n${footer.trim()}\n`
    : readme;

  const destDir = path.dirname(parsed.dest);
  await fs.mkdir(destDir, { recursive: true });
  await fs.writeFile(parsed.dest, combined, 'utf8');

  if (footer) {
    console.log(
      `[makage] wrote README with footer: ${parsed.source} + ${parsed.footer} -> ${parsed.dest}`
    );
  } else {
    console.log(
      `[makage] wrote README: ${parsed.source} -> ${parsed.dest}`
    );
  }
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
