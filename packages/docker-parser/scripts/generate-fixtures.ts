import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.join(__dirname, '../../../__fixtures__/docker');
const OUTPUT_FILE = path.join(FIXTURES_DIR, 'generated/generated.json');

function collectFixtures(dir: string, basePath: string = ''): Record<string, string> {
  const fixtures: Record<string, string> = {};
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    
    if (entry.isDirectory()) {
      if (entry.name !== 'generated') {
        Object.assign(fixtures, collectFixtures(fullPath, relativePath));
      }
    } else if (entry.name.endsWith('.dockerfile') || entry.name === 'Dockerfile') {
      const content = fs.readFileSync(fullPath, 'utf-8');
      fixtures[relativePath] = content;
    }
  }
  
  return fixtures;
}

function main() {
  console.log('Collecting fixtures from:', FIXTURES_DIR);
  
  const fixtures = collectFixtures(FIXTURES_DIR);
  
  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(fixtures, null, 2));
  
  console.log(`Generated ${Object.keys(fixtures).length} fixtures to:`, OUTPUT_FILE);
}

main();
