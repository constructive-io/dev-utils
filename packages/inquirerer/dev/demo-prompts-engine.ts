/**
 * Demo: Engine-based Prompts
 * 
 * This demo tests all three engine-based prompt implementations (list, autocomplete, checkbox)
 * running sequentially to verify keypress lifecycle and cleanup works correctly.
 * 
 * Run with: pnpm dev:prompts
 */

import { Inquirerer } from '../src';
import { 
  listPromptEngine, 
  autocompletePromptEngine, 
  checkboxPromptEngine,
  ListPromptConfig,
  AutocompletePromptConfig,
  CheckboxPromptConfig
} from '../src/ui';
import { TerminalKeypress } from '../src/keypress';
import { white, green, cyan, yellow, dim } from 'yanse';

const COLORS = [
  { name: 'Red', value: 'red' },
  { name: 'Green', value: 'green' },
  { name: 'Blue', value: 'blue' },
  { name: 'Yellow', value: 'yellow' },
  { name: 'Purple', value: 'purple' },
  { name: 'Orange', value: 'orange' },
  { name: 'Pink', value: 'pink' },
  { name: 'Cyan', value: 'cyan' },
];

const FRAMEWORKS = [
  { name: 'React', value: 'react' },
  { name: 'Vue', value: 'vue' },
  { name: 'Angular', value: 'angular' },
  { name: 'Svelte', value: 'svelte' },
  { name: 'Next.js', value: 'nextjs' },
  { name: 'Nuxt', value: 'nuxt' },
  { name: 'Remix', value: 'remix' },
  { name: 'Astro', value: 'astro' },
  { name: 'SolidJS', value: 'solidjs' },
  { name: 'Qwik', value: 'qwik' },
];

const FEATURES = [
  { name: 'TypeScript', value: 'typescript' },
  { name: 'ESLint', value: 'eslint' },
  { name: 'Prettier', value: 'prettier' },
  { name: 'Testing', value: 'testing' },
  { name: 'CI/CD', value: 'cicd' },
  { name: 'Docker', value: 'docker' },
  { name: 'Storybook', value: 'storybook' },
  { name: 'PWA', value: 'pwa' },
];

async function main() {
  console.log(white('\n=== Engine-based Prompts Demo ===\n'));
  console.log(dim('This demo tests all three prompt types using the new UIEngine.'));
  console.log(dim('Each prompt runs sequentially to verify keypress lifecycle.\n'));
  
  // Create a shared keypress instance (simulating how Inquirerer works)
  const keypress = new TerminalKeypress(false, process.stdin);
  
  try {
    // =========================================================================
    // Test 1: List Prompt (simplest - no filtering)
    // =========================================================================
    console.log(cyan('\n--- Test 1: List Prompt ---'));
    console.log(dim('Use UP/DOWN arrows to navigate, ENTER to select\n'));
    
    const listConfig: ListPromptConfig = {
      options: COLORS,
      promptMessage: white('Pick your favorite color: '),
      maxLines: 5,
      keypress,
      input: process.stdin,
      output: process.stdout,
      noTty: false,
    };
    
    const colorResult = await listPromptEngine(listConfig);
    console.log(green(`\nYou selected: ${colorResult}\n`));
    
    // =========================================================================
    // Test 2: Autocomplete Prompt (filtering + space as input)
    // =========================================================================
    console.log(cyan('\n--- Test 2: Autocomplete Prompt ---'));
    console.log(dim('Type to filter, UP/DOWN to navigate, ENTER to select\n'));
    
    const autocompleteConfig: AutocompletePromptConfig = {
      options: FRAMEWORKS,
      promptMessage: white('Choose a framework: '),
      maxLines: 6,
      keypress,
      input: process.stdin,
      output: process.stdout,
      noTty: false,
    };
    
    const frameworkResult = await autocompletePromptEngine(autocompleteConfig);
    console.log(green(`\nYou selected: ${frameworkResult}\n`));
    
    // =========================================================================
    // Test 3: Checkbox Prompt (filtering + space to toggle)
    // =========================================================================
    console.log(cyan('\n--- Test 3: Checkbox Prompt ---'));
    console.log(dim('Type to filter, UP/DOWN to navigate, SPACE to toggle, ENTER to confirm\n'));
    
    const checkboxConfig: CheckboxPromptConfig = {
      options: FEATURES,
      defaultSelections: [true, true, false, false, false, false, false, false], // TypeScript and ESLint pre-selected
      promptMessage: white('Select features to include: '),
      maxLines: 6,
      returnFullResults: false,
      keypress,
      input: process.stdin,
      output: process.stdout,
      noTty: false,
    };
    
    const featuresResult = await checkboxPromptEngine(checkboxConfig);
    console.log(green(`\nYou selected: ${featuresResult.map(f => f.name).join(', ')}\n`));
    
    // =========================================================================
    // Summary
    // =========================================================================
    console.log(white('\n=== Summary ==='));
    console.log(`Color: ${yellow(colorResult)}`);
    console.log(`Framework: ${yellow(frameworkResult)}`);
    console.log(`Features: ${yellow(featuresResult.map(f => f.name).join(', '))}`);
    console.log(green('\nAll prompts completed successfully!'));
    console.log(dim('Keypress lifecycle worked correctly across all three prompts.\n'));
    
  } finally {
    // Cleanup
    keypress.destroy();
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
