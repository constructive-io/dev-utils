import path from 'node:path';
import { runCopy } from './copy';
import { runReadmeFooter } from './readmeFooter';

export async function runAssets(_args: string[]) {
  // assumes we are in the package dir, LICENSE lives two levels up
  await runCopy(['../../LICENSE', 'package.json', 'dist', '--flat']);

  // README + FOOTER -> dist/README.md
  await runReadmeFooter([
    '--source', 'README.md',
    '--footer', 'FOOTER.md',
    '--dest', path.join('dist', 'README.md')
  ]);
}
