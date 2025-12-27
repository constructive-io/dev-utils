#!/usr/bin/env node
/**
 * Demo: Spinners and Loaders
 * 
 * Run with: pnpm dev:spinner
 * Or: npx ts-node dev/demo-spinner.ts
 */

import { createSpinner, SPINNER_STYLES } from '../src/ui';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('\n🎨 Spinner Demo\n');
  console.log('This demo shows various spinner styles and states.\n');

  // Basic spinner
  const spinner1 = createSpinner('Loading packages...');
  spinner1.start();
  await sleep(2000);
  spinner1.succeed('Packages loaded successfully');

  await sleep(500);

  // Spinner with text updates
  const spinner2 = createSpinner('Connecting to server...');
  spinner2.start();
  await sleep(1000);
  spinner2.text('Authenticating...');
  await sleep(1000);
  spinner2.text('Fetching data...');
  await sleep(1000);
  spinner2.succeed('Data fetched');

  await sleep(500);

  // Error state
  const spinner3 = createSpinner('Installing dependencies...');
  spinner3.start();
  await sleep(1500);
  spinner3.fail('Failed to install: network error');

  await sleep(500);

  // Warning state
  const spinner4 = createSpinner('Checking for updates...');
  spinner4.start();
  await sleep(1500);
  spinner4.warn('Updates available but not critical');

  await sleep(500);

  // Info state
  const spinner5 = createSpinner('Scanning project...');
  spinner5.start();
  await sleep(1500);
  spinner5.info('Found 42 files');

  await sleep(500);

  // Different spinner styles
  console.log('\n📊 Spinner Styles:\n');

  const styles: Array<[string, string[]]> = [
    ['dots', SPINNER_STYLES.dots],
    ['line', SPINNER_STYLES.line],
    ['arc', SPINNER_STYLES.arc],
    ['circle', SPINNER_STYLES.circle],
    ['bounce', SPINNER_STYLES.bounce],
    ['arrow', SPINNER_STYLES.arrow],
    ['dots2', SPINNER_STYLES.dots2],
  ];

  for (const [name, frames] of styles) {
    const spinner = createSpinner(`Style: ${name}`, { frames, interval: 100 });
    spinner.start();
    await sleep(1500);
    spinner.succeed(`${name} complete`);
    await sleep(200);
  }

  console.log('\n✨ Demo complete!\n');
}

main().catch(console.error);
