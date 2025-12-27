/**
 * Engine-based prompt implementations
 * 
 * These are internal implementations of the standard prompts (list, autocomplete, checkbox)
 * using the UIEngine for rendering and event handling.
 */

import { blue } from 'yanse';
import { UIEngine } from './engine';
import { Key, UIEvent, EventResult } from './types';
import { TerminalKeypress } from '../keypress';
import { OptionValue } from '../question';
import { Readable, Writable } from 'stream';

/**
 * Render the prompt header lines
 */
export function renderPromptHeader(
  promptMessage: string,
  input: string
): string[] {
  const inputLine = `> ${input}`;
  return [promptMessage + inputLine];
}

/**
 * Fuzzy match function (matches existing prompt.ts behavior)
 */
function fuzzyMatch(option: string, input: string): boolean {
  if (!input || !input.trim().length) return true;
  const length = input.length;
  let position = 0;
  
  for (let i = 0; i < option.length; i++) {
    if (option[i] === input[position]) {
      position++;
      if (position === length) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Filter options based on input (matches existing prompt.ts behavior)
 */
export function filterOptions(options: OptionValue[], input: string): OptionValue[] {
  const normalizedInput = input.toLowerCase();
  
  return options
    .filter(option => fuzzyMatch(option.name.toLowerCase(), normalizedInput))
    .sort((a, b) => {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });
}

// ============================================================================
// LIST PROMPT (Engine-based)
// ============================================================================

interface ListState {
  options: OptionValue[];
  selectedIndex: number;
  startIndex: number;
  maxLines: number;
  promptMessage: string;
}

function listRender(state: ListState): string[] {
  const lines: string[] = [];
  
  // Header
  lines.push(state.promptMessage);
  
  // Options
  const endIndex = Math.min(state.startIndex + state.maxLines, state.options.length);
  for (let i = state.startIndex; i < endIndex; i++) {
    const option = state.options[i];
    if (!option) {
      lines.push('No options');
    } else if (i === state.selectedIndex) {
      lines.push(blue('> ' + option.name));
    } else {
      lines.push('  ' + option.name);
    }
  }
  
  return lines;
}

function listOnEvent(event: UIEvent, state: ListState): EventResult<ListState, OptionValue> {
  const { options, maxLines } = state;
  let { selectedIndex, startIndex } = state;
  
  if (event.type === 'key') {
    switch (event.key) {
      case Key.UP:
        selectedIndex = selectedIndex - 1 >= 0 ? selectedIndex - 1 : options.length - 1;
        if (selectedIndex < startIndex) {
          startIndex = selectedIndex;
        } else if (selectedIndex === options.length - 1) {
          startIndex = Math.max(0, options.length - maxLines);
        }
        break;
        
      case Key.DOWN:
        selectedIndex = (selectedIndex + 1) % options.length;
        if (selectedIndex >= startIndex + maxLines) {
          startIndex = selectedIndex - maxLines + 1;
        } else if (selectedIndex === 0) {
          startIndex = 0;
        }
        break;
        
      case Key.ENTER:
        return {
          state: { ...state, selectedIndex, startIndex },
          done: true,
          value: options[selectedIndex]?.value
        };
    }
  }
  
  return { state: { ...state, selectedIndex, startIndex } };
}

export interface ListPromptConfig {
  options: OptionValue[];
  promptMessage: string;
  maxLines: number;
  keypress: TerminalKeypress;
  input: Readable;
  output: Writable;
  noTty: boolean;
}

export async function listPromptEngine(config: ListPromptConfig): Promise<any> {
  const engine = new UIEngine({
    keypress: config.keypress,
    ownsKeypress: false,
    input: config.input,
    output: config.output,
    noTty: config.noTty,
    clearScreenOnStart: true,
  });
  
  const initialState: ListState = {
    options: config.options,
    selectedIndex: 0,
    startIndex: 0,
    maxLines: config.maxLines,
    promptMessage: config.promptMessage,
  };
  
  return engine.run<ListState, OptionValue>({
    initialState,
    render: listRender,
    onEvent: listOnEvent,
  });
}

// ============================================================================
// AUTOCOMPLETE PROMPT (Engine-based)
// ============================================================================

interface AutocompleteState {
  options: OptionValue[];
  filteredOptions: OptionValue[];
  input: string;
  selectedIndex: number;
  startIndex: number;
  maxLines: number;
  promptMessage: string;
}

function autocompleteRender(state: AutocompleteState): string[] {
  const lines: string[] = [];
  
  // Header with input
  lines.push(state.promptMessage + `> ${state.input}`);
  
  // Filtered options
  const endIndex = Math.min(state.startIndex + state.maxLines, state.filteredOptions.length);
  for (let i = state.startIndex; i < endIndex; i++) {
    const option = state.filteredOptions[i];
    if (!option) {
      lines.push('No options');
    } else if (i === state.selectedIndex) {
      lines.push(blue('> ' + option.name));
    } else {
      lines.push('  ' + option.name);
    }
  }
  
  return lines;
}

function autocompleteOnEvent(event: UIEvent, state: AutocompleteState): EventResult<AutocompleteState, any> {
  const { options, maxLines } = state;
  let { input, filteredOptions, selectedIndex, startIndex } = state;
  
  const updateFiltered = () => {
    filteredOptions = filterOptions(options, input);
    if (selectedIndex < startIndex) {
      startIndex = selectedIndex;
    } else if (selectedIndex >= startIndex + maxLines) {
      startIndex = selectedIndex - maxLines + 1;
    }
    if (selectedIndex >= filteredOptions.length) {
      selectedIndex = Math.max(filteredOptions.length - 1, 0);
    }
  };
  
  if (event.type === 'key') {
    switch (event.key) {
      case Key.UP:
        if (filteredOptions.length === 0) break;
        selectedIndex = selectedIndex - 1 >= 0 ? selectedIndex - 1 : filteredOptions.length - 1;
        if (selectedIndex < startIndex) {
          startIndex = selectedIndex;
        } else if (selectedIndex === filteredOptions.length - 1) {
          startIndex = Math.max(0, filteredOptions.length - maxLines);
        }
        break;
        
      case Key.DOWN:
        if (filteredOptions.length === 0) break;
        selectedIndex = (selectedIndex + 1) % filteredOptions.length;
        if (selectedIndex >= startIndex + maxLines) {
          startIndex = selectedIndex - maxLines + 1;
        } else if (selectedIndex === 0) {
          startIndex = 0;
        }
        break;
        
      case Key.BACKSPACE:
        input = input.slice(0, -1);
        updateFiltered();
        break;
        
      case Key.SPACE:
        // In autocomplete, space is part of input (unlike checkbox)
        input += ' ';
        updateFiltered();
        break;
        
      case Key.ENTER:
        return {
          state: { ...state, input, filteredOptions, selectedIndex, startIndex },
          done: true,
          value: filteredOptions[selectedIndex]?.value || input
        };
    }
  } else if (event.type === 'char') {
    input += event.char;
    updateFiltered();
  }
  
  return { state: { ...state, input, filteredOptions, selectedIndex, startIndex } };
}

export interface AutocompletePromptConfig {
  options: OptionValue[];
  promptMessage: string;
  maxLines: number;
  keypress: TerminalKeypress;
  input: Readable;
  output: Writable;
  noTty: boolean;
}

export async function autocompletePromptEngine(config: AutocompletePromptConfig): Promise<any> {
  const engine = new UIEngine({
    keypress: config.keypress,
    ownsKeypress: false,
    input: config.input,
    output: config.output,
    noTty: config.noTty,
    clearScreenOnStart: true,
  });
  
  const initialState: AutocompleteState = {
    options: config.options,
    filteredOptions: config.options,
    input: '',
    selectedIndex: 0,
    startIndex: 0,
    maxLines: config.maxLines,
    promptMessage: config.promptMessage,
  };
  
  return engine.run<AutocompleteState, any>({
    initialState,
    render: autocompleteRender,
    onEvent: autocompleteOnEvent,
  });
}

// ============================================================================
// CHECKBOX PROMPT (Engine-based)
// ============================================================================

interface CheckboxState {
  options: OptionValue[];
  filteredOptions: OptionValue[];
  selections: boolean[];
  input: string;
  selectedIndex: number;
  startIndex: number;
  maxLines: number;
  promptMessage: string;
  returnFullResults: boolean;
}

function checkboxRender(state: CheckboxState): string[] {
  const lines: string[] = [];
  
  // Header with input
  lines.push(state.promptMessage + `> ${state.input}`);
  
  // Filtered options with checkboxes
  const endIndex = Math.min(state.startIndex + state.maxLines, state.filteredOptions.length);
  for (let i = state.startIndex; i < endIndex; i++) {
    const option = state.filteredOptions[i];
    const isSelected = state.selectedIndex === i;
    const marker = isSelected ? '>' : ' ';
    
    // Find original index to get selection state
    const originalIndex = state.options.findIndex(o => o.name === option.name);
    if (originalIndex >= 0) {
      const isChecked = state.selections[originalIndex] ? '◉' : '○';
      const line = `${marker} ${isChecked} ${option.name}`;
      lines.push(isSelected ? blue(line) : line);
    } else {
      lines.push('No options');
    }
  }
  
  return lines;
}

function checkboxOnEvent(event: UIEvent, state: CheckboxState): EventResult<CheckboxState, OptionValue[]> {
  const { options, maxLines, returnFullResults } = state;
  let { input, filteredOptions, selections, selectedIndex, startIndex } = state;
  
  const updateFiltered = () => {
    filteredOptions = filterOptions(options, input);
    // Clamp selectedIndex and startIndex when filtered results change
    if (filteredOptions.length === 0) {
      selectedIndex = 0;
      startIndex = 0;
    } else {
      if (selectedIndex >= filteredOptions.length) {
        selectedIndex = filteredOptions.length - 1;
      }
      if (startIndex > Math.max(0, filteredOptions.length - maxLines)) {
        startIndex = Math.max(0, filteredOptions.length - maxLines);
      }
    }
  };
  
  if (event.type === 'key') {
    switch (event.key) {
      case Key.UP:
        if (filteredOptions.length === 0) break;
        selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : filteredOptions.length - 1;
        if (selectedIndex < startIndex) {
          startIndex = selectedIndex;
        } else if (selectedIndex === filteredOptions.length - 1) {
          startIndex = Math.max(0, filteredOptions.length - maxLines);
        }
        break;
        
      case Key.DOWN:
        if (filteredOptions.length === 0) break;
        selectedIndex = (selectedIndex + 1) % filteredOptions.length;
        if (selectedIndex >= startIndex + maxLines) {
          startIndex = selectedIndex - maxLines + 1;
        } else if (selectedIndex === 0) {
          startIndex = 0;
        }
        break;
        
      case Key.BACKSPACE:
        input = input.slice(0, -1);
        updateFiltered();
        break;
        
      case Key.SPACE:
        // Toggle selection
        if (filteredOptions.length > 0 && filteredOptions[selectedIndex]) {
          const originalIndex = options.indexOf(filteredOptions[selectedIndex]);
          if (originalIndex >= 0) {
            selections = [...selections];
            selections[originalIndex] = !selections[originalIndex];
          }
        }
        break;
        
      case Key.ENTER:
        const result: OptionValue[] = [];
        if (returnFullResults) {
          options.forEach((option, index) => {
            result.push({
              name: option.name,
              value: option.value,
              selected: selections[index]
            });
          });
        } else {
          options.forEach((option, index) => {
            if (selections[index]) {
              result.push({
                name: option.name,
                value: option.value,
                selected: true
              });
            }
          });
        }
        return {
          state: { ...state, input, filteredOptions, selections, selectedIndex, startIndex },
          done: true,
          value: result
        };
    }
  } else if (event.type === 'char') {
    input += event.char;
    updateFiltered();
  }
  
  return { state: { ...state, input, filteredOptions, selections, selectedIndex, startIndex } };
}

export interface CheckboxPromptConfig {
  options: OptionValue[];
  defaultSelections: boolean[];
  promptMessage: string;
  maxLines: number;
  returnFullResults: boolean;
  keypress: TerminalKeypress;
  input: Readable;
  output: Writable;
  noTty: boolean;
}

export async function checkboxPromptEngine(config: CheckboxPromptConfig): Promise<OptionValue[]> {
  const engine = new UIEngine({
    keypress: config.keypress,
    ownsKeypress: false,
    input: config.input,
    output: config.output,
    noTty: config.noTty,
    clearScreenOnStart: true,
  });
  
  const initialState: CheckboxState = {
    options: config.options,
    filteredOptions: config.options,
    selections: config.defaultSelections,
    input: '',
    selectedIndex: 0,
    startIndex: 0,
    maxLines: config.maxLines,
    promptMessage: config.promptMessage,
    returnFullResults: config.returnFullResults,
  };
  
  return engine.run<CheckboxState, OptionValue[]>({
    initialState,
    render: checkboxRender,
    onEvent: checkboxOnEvent,
  }) as Promise<OptionValue[]>;
}
