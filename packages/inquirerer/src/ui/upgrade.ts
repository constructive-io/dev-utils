/**
 * Interactive Upgrade UI Component
 * 
 * pnpm-style interactive dependency upgrade interface
 */

import { UIEngine } from './engine';
import { Key, UIEvent, EventResult, PackageInfo, UpgradeSelection } from './types';
import { cyan, green, yellow, red, dim, white, blue, gray } from 'yanse';

interface UpgradeState {
  packages: PackageInfo[];
  selections: Map<string, UpgradeSelection>;
  selectedIndex: number;
  startIndex: number;
  maxLines: number;
  filter: string;
  mode: 'select' | 'version';
  versionOptions: string[];
  versionIndex: number;
}

interface UpgradeConfig {
  packages: PackageInfo[];
  maxLines?: number;
}

interface UpgradeResult {
  updates: Array<{
    name: string;
    from: string;
    to: string;
  }>;
}

/**
 * Render a single package row
 */
function renderPackageRow(
  pkg: PackageInfo,
  selection: UpgradeSelection,
  isSelected: boolean,
  isVersionMode: boolean,
  versionIndex: number,
  versionOptions: string[]
): string {
  const checkbox = selection.selected ? green('◉') : dim('○');
  const cursor = isSelected ? cyan('❯') : ' ';
  
  const name = pkg.name.padEnd(30);
  const current = dim(pkg.current.padEnd(12));
  const arrow = dim('→');
  
  let target: string;
  if (isSelected && isVersionMode) {
    // Show version selector
    const versions = versionOptions.map((v, i) => 
      i === versionIndex ? cyan(`[${v}]`) : dim(v)
    ).join(' ');
    target = versions;
  } else {
    target = selection.selected 
      ? green(selection.targetVersion.padEnd(12))
      : dim(selection.targetVersion.padEnd(12));
  }
  
  const type = dim(`(${pkg.type.replace('Dependencies', '')})`);
  
  return `${cursor} ${checkbox} ${name} ${current} ${arrow} ${target} ${type}`;
}

/**
 * Create the upgrade UI
 */
export async function interactiveUpgrade(
  engine: UIEngine,
  config: UpgradeConfig
): Promise<UpgradeResult> {
  const { packages, maxLines = 10 } = config;
  
  // Initialize selections
  const selections = new Map<string, UpgradeSelection>();
  packages.forEach(pkg => {
    selections.set(pkg.name, {
      selected: false,
      targetVersion: pkg.latest,
    });
  });
  
  const initialState: UpgradeState = {
    packages,
    selections,
    selectedIndex: 0,
    startIndex: 0,
    maxLines,
    filter: '',
    mode: 'select',
    versionOptions: [],
    versionIndex: 0,
  };
  
  const result = await engine.run<UpgradeState, UpgradeResult>({
    initialState,
    hideCursor: true,
    
    render: (state) => {
      const lines: string[] = [];
      
      // Header
      lines.push(white('Interactive Dependency Upgrade'));
      lines.push(dim('Use ↑↓ to navigate, SPACE to select, → to change version, ENTER to confirm'));
      lines.push('');
      
      // Column headers
      const header = `  ${dim('  Package'.padEnd(32))} ${dim('Current'.padEnd(12))}   ${dim('Target'.padEnd(12))} ${dim('Type')}`;
      lines.push(header);
      lines.push(dim('─'.repeat(80)));
      
      // Filter packages if filter is set
      let filteredPackages = state.packages;
      if (state.filter) {
        filteredPackages = state.packages.filter(p => 
          p.name.toLowerCase().includes(state.filter.toLowerCase())
        );
      }
      
      // Calculate visible range
      const endIndex = Math.min(state.startIndex + state.maxLines, filteredPackages.length);
      
      // Render visible packages
      for (let i = state.startIndex; i < endIndex; i++) {
        const pkg = filteredPackages[i];
        const selection = state.selections.get(pkg.name)!;
        const isSelected = i === state.selectedIndex;
        const isVersionMode = state.mode === 'version' && isSelected;
        
        lines.push(renderPackageRow(
          pkg,
          selection,
          isSelected,
          isVersionMode,
          state.versionIndex,
          state.versionOptions
        ));
      }
      
      // Padding if fewer packages than maxLines
      for (let i = filteredPackages.length; i < state.maxLines; i++) {
        lines.push('');
      }
      
      lines.push(dim('─'.repeat(80)));
      
      // Summary
      const selectedCount = Array.from(state.selections.values()).filter(s => s.selected).length;
      lines.push(`${cyan(selectedCount.toString())} packages selected for upgrade`);
      
      // Filter indicator
      if (state.filter) {
        lines.push(dim(`Filter: ${state.filter}`));
      }
      
      return lines;
    },
    
    onEvent: (event, state): EventResult<UpgradeState, UpgradeResult> => {
      // Get filtered packages for navigation
      let filteredPackages = state.packages;
      if (state.filter) {
        filteredPackages = state.packages.filter(p => 
          p.name.toLowerCase().includes(state.filter.toLowerCase())
        );
      }
      
      if (event.type === 'key') {
        switch (event.key) {
          case Key.UP: {
            if (filteredPackages.length === 0) return { state };
            
            let newIndex = state.selectedIndex - 1;
            let newStartIndex = state.startIndex;
            
            if (newIndex < 0) {
              newIndex = filteredPackages.length - 1;
              newStartIndex = Math.max(0, filteredPackages.length - state.maxLines);
            } else if (newIndex < state.startIndex) {
              newStartIndex = newIndex;
            }
            
            return {
              state: {
                ...state,
                selectedIndex: newIndex,
                startIndex: newStartIndex,
                mode: 'select',
              }
            };
          }
          
          case Key.DOWN: {
            if (filteredPackages.length === 0) return { state };
            
            let newIndex = (state.selectedIndex + 1) % filteredPackages.length;
            let newStartIndex = state.startIndex;
            
            if (newIndex === 0) {
              newStartIndex = 0;
            } else if (newIndex >= state.startIndex + state.maxLines) {
              newStartIndex = newIndex - state.maxLines + 1;
            }
            
            return {
              state: {
                ...state,
                selectedIndex: newIndex,
                startIndex: newStartIndex,
                mode: 'select',
              }
            };
          }
          
          case Key.SPACE: {
            if (filteredPackages.length === 0) return { state };
            
            const pkg = filteredPackages[state.selectedIndex];
            const newSelections = new Map(state.selections);
            const current = newSelections.get(pkg.name)!;
            newSelections.set(pkg.name, {
              ...current,
              selected: !current.selected,
            });
            
            return {
              state: {
                ...state,
                selections: newSelections,
              }
            };
          }
          
          case Key.RIGHT: {
            if (filteredPackages.length === 0) return { state };
            
            const pkg = filteredPackages[state.selectedIndex];
            // Generate version options (simplified - in real use, these would come from npm)
            const versionOptions = [
              pkg.latest,
              `^${pkg.latest}`,
              `~${pkg.latest}`,
              pkg.current,
            ];
            
            return {
              state: {
                ...state,
                mode: 'version',
                versionOptions,
                versionIndex: 0,
              }
            };
          }
          
          case Key.LEFT: {
            if (state.mode === 'version') {
              const newIndex = (state.versionIndex - 1 + state.versionOptions.length) % state.versionOptions.length;
              return {
                state: {
                  ...state,
                  versionIndex: newIndex,
                }
              };
            }
            return { state };
          }
          
          case Key.ENTER: {
            if (state.mode === 'version') {
              // Apply selected version
              const pkg = filteredPackages[state.selectedIndex];
              const newSelections = new Map(state.selections);
              const current = newSelections.get(pkg.name)!;
              newSelections.set(pkg.name, {
                ...current,
                selected: true,
                targetVersion: state.versionOptions[state.versionIndex],
              });
              
              return {
                state: {
                  ...state,
                  selections: newSelections,
                  mode: 'select',
                }
              };
            }
            
            // Confirm and return results
            const updates: UpgradeResult['updates'] = [];
            state.selections.forEach((selection, name) => {
              if (selection.selected) {
                const pkg = state.packages.find(p => p.name === name)!;
                updates.push({
                  name,
                  from: pkg.current,
                  to: selection.targetVersion,
                });
              }
            });
            
            return {
              state,
              done: true,
              value: { updates },
            };
          }
          
          case Key.ESCAPE: {
            if (state.mode === 'version') {
              return {
                state: {
                  ...state,
                  mode: 'select',
                }
              };
            }
            // Cancel
            return {
              state,
              done: true,
              value: { updates: [] },
            };
          }
          
          case Key.BACKSPACE: {
            if (state.filter.length > 0) {
              return {
                state: {
                  ...state,
                  filter: state.filter.slice(0, -1),
                  selectedIndex: 0,
                  startIndex: 0,
                }
              };
            }
            return { state };
          }
        }
      }
      
      // Handle character input for filtering
      if (event.type === 'char') {
        return {
          state: {
            ...state,
            filter: state.filter + event.char,
            selectedIndex: 0,
            startIndex: 0,
          }
        };
      }
      
      return { state };
    },
  });
  
  return result ?? { updates: [] };
}

/**
 * Standalone upgrade prompt
 */
export async function upgradePrompt(packages: PackageInfo[], maxLines?: number): Promise<UpgradeResult> {
  const engine = new UIEngine();
  try {
    return await interactiveUpgrade(engine, { packages, maxLines });
  } finally {
    engine.destroy();
  }
}
