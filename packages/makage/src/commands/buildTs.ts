import { spawn } from 'node:child_process';

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

export async function runBuildTs(_args: string[]) {
  console.log('[makage] tsc (CJS)');
  await run('tsc', []);

  console.log('[makage] tsc (ESM)');
  await run('tsc', ['-p', 'tsconfig.esm.json']);
}
