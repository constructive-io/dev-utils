import fs from 'node:fs/promises';

export async function runClean(paths: string[]) {
  if (!paths.length) {
    throw new Error('clean requires at least one path');
  }

  for (const p of paths) {
    await fs.rm(p, { recursive: true, force: true });
    console.log(`[makage] removed ${p}`);
  }
}
