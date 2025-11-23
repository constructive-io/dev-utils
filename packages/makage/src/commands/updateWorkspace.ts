import fs from 'node:fs/promises';
import path from 'node:path';

const DEPENDENCY_TYPES = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies'
] as const;

export async function runUpdateWorkspace(_args: string[]) {
  // Find all package.json files in the workspace
  const packagesDir = path.join(process.cwd(), 'packages');

  try {
    await fs.access(packagesDir);
  } catch {
    throw new Error('No "packages" directory found. Run this command from the monorepo root.');
  }

  const dirs = await fs.readdir(packagesDir, { withFileTypes: true });
  const packageDirs = dirs
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  const packageFiles: string[] = [];
  for (const dir of packageDirs) {
    const pkgPath = path.join(packagesDir, dir, 'package.json');
    try {
      await fs.access(pkgPath);
      packageFiles.push(path.join(dir, 'package.json'));
    } catch {
      // Skip if no package.json
    }
  }

  // Build a set of internal package names
  const internalPackages = new Set<string>();
  for (const file of packageFiles) {
    const pkgPath = path.join(packagesDir, file);
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);
    if (pkg.name) {
      internalPackages.add(pkg.name);
    }
  }

  console.log(`[makage] Found ${internalPackages.size} internal packages:`, Array.from(internalPackages));

  // Update each package.json
  let totalUpdates = 0;
  for (const file of packageFiles) {
    const pkgPath = path.join(packagesDir, file);
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);

    let modified = false;

    // Update dependencies
    for (const depType of DEPENDENCY_TYPES) {
      if (pkg[depType]) {
        for (const depName of Object.keys(pkg[depType])) {
          if (internalPackages.has(depName)) {
            const currentVersion = pkg[depType][depName];
            // Skip if already using workspace protocol
            if (!currentVersion.startsWith('workspace:')) {
              pkg[depType][depName] = 'workspace:*';
              console.log(`  ${pkg.name}: ${depName} ${currentVersion} -> workspace:*`);
              modified = true;
              totalUpdates++;
            }
          }
        }
      }
    }

    if (modified) {
      await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    }
  }

  console.log(`\n[makage] ✅ Updated ${totalUpdates} dependencies to workspace:*`);
}
