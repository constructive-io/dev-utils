import fs from 'node:fs/promises';
import path from 'node:path';

interface CopyOptions {
  flat: boolean;
}

// Very simple arg parser: last non-flag is dest, the rest are sources
export async function runCopy(args: string[]) {
  const opts: CopyOptions = { flat: false };
  const positional: string[] = [];

  for (const arg of args) {
    if (arg === '--flat') {
      opts.flat = true;
    } else {
      positional.push(arg);
    }
  }

  if (positional.length < 2) {
    throw new Error('copy requires at least one source and one destination');
  }

  const dest = positional[positional.length - 1];
  const sources = positional.slice(0, -1);

  await fs.mkdir(dest, { recursive: true });

  for (const src of sources) {
    const stat = await fs.stat(src);
    if (stat.isDirectory()) {
      throw new Error(`Directories not yet supported as sources: ${src}`);
    }

    const baseName = path.basename(src);
    const target = opts.flat
      ? path.join(dest, baseName)
      : path.join(dest, src);

    const targetDir = path.dirname(target);
    await fs.mkdir(targetDir, { recursive: true });

    await fs.copyFile(src, target);
    console.log(`[makage] copied ${src} -> ${target}`);
  }
}
