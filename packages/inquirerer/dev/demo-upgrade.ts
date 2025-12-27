#!/usr/bin/env node
/**
 * Demo: Interactive Dependency Upgrade UI
 * 
 * Run with: pnpm dev:upgrade
 * Or: npx ts-node dev/demo-upgrade.ts
 */

import { upgradePrompt, PackageInfo, createSpinner } from '../src/ui';
import { cyan, green, yellow, dim, white } from 'yanse';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simulated package data (like pnpm outdated would return)
const MOCK_PACKAGES: PackageInfo[] = [
  { name: 'typescript', current: '5.2.2', latest: '5.7.2', type: 'devDependencies' },
  { name: 'react', current: '18.2.0', latest: '19.0.0', type: 'dependencies' },
  { name: 'react-dom', current: '18.2.0', latest: '19.0.0', type: 'dependencies' },
  { name: '@types/node', current: '20.8.0', latest: '22.10.2', type: 'devDependencies' },
  { name: 'eslint', current: '8.50.0', latest: '9.17.0', type: 'devDependencies' },
  { name: 'prettier', current: '3.0.3', latest: '3.4.2', type: 'devDependencies' },
  { name: 'jest', current: '29.6.4', latest: '29.7.0', type: 'devDependencies' },
  { name: 'lodash', current: '4.17.20', latest: '4.17.21', type: 'dependencies' },
  { name: 'axios', current: '1.5.0', latest: '1.7.9', type: 'dependencies' },
  { name: 'zod', current: '3.22.2', latest: '3.24.1', type: 'dependencies' },
  { name: 'vitest', current: '0.34.4', latest: '2.1.8', type: 'devDependencies' },
  { name: '@tanstack/react-query', current: '4.35.3', latest: '5.62.8', type: 'dependencies' },
  { name: 'tailwindcss', current: '3.3.3', latest: '3.4.17', type: 'devDependencies' },
  { name: 'next', current: '13.5.2', latest: '15.1.3', type: 'dependencies' },
  { name: 'prisma', current: '5.3.1', latest: '6.1.0', type: 'devDependencies' },
];

async function main() {
  console.log('\n' + white('═'.repeat(70)));
  console.log(white('  📦 Interactive Dependency Upgrade Demo'));
  console.log(white('═'.repeat(70)) + '\n');

  // Show loading spinner first
  const spinner = createSpinner('Checking for outdated packages...');
  spinner.start();
  await sleep(1500);
  spinner.succeed(`Found ${MOCK_PACKAGES.length} packages with updates available`);

  console.log('');
  console.log(dim('Controls:'));
  console.log(dim('  ↑/↓     Navigate packages'));
  console.log(dim('  SPACE   Toggle selection'));
  console.log(dim('  →       Change target version'));
  console.log(dim('  ENTER   Confirm selection'));
  console.log(dim('  ESC     Cancel'));
  console.log(dim('  Type    Filter packages'));
  console.log('');

  try {
    const result = await upgradePrompt(MOCK_PACKAGES, 10);

    console.log('');
    
    if (result.updates.length === 0) {
      console.log(yellow('No packages selected for upgrade.'));
    } else {
      console.log(green(`\n✔ Selected ${result.updates.length} packages for upgrade:\n`));
      
      for (const update of result.updates) {
        console.log(`  ${cyan(update.name.padEnd(30))} ${dim(update.from)} ${dim('→')} ${green(update.to)}`);
      }
      
      console.log('');
      console.log(dim('In a real scenario, this would run:'));
      console.log(dim(`  pnpm update ${result.updates.map(u => `${u.name}@${u.to}`).join(' ')}`));
    }
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n' + white('═'.repeat(70)));
  console.log(white('  ✨ Demo complete!'));
  console.log(white('═'.repeat(70)) + '\n');
}

main().catch(console.error);
