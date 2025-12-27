#!/usr/bin/env node
/**
 * Demo: Constructive Logo Animation
 * 
 * Run with: pnpm dev:constructive
 * Or: npx ts-node dev/demo-constructive.ts
 */

import { createSpinner, UIEngine, Key } from '../src/ui';
import { cyan, green, yellow, dim, white, magenta, blue } from 'yanse';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Constructive logo ASCII art
const CONSTRUCTIVE_LOGO = `
                                                       .=====:                                      
                                                    .===     .==-                                   
                                                 .==-           .==-.                               
                                              :==:                 .-==.                            
                                           -==.                        -==.                         
                                       .-==-==.                       .-===                         
                                    .-==.     :==:                 .=======                         
                                 .===            .==-           .==========                         
                              .==-                  .==-.    :=============                         
                           :==:                        .===================                         
                           ====.                       -===================                         
                           =:  ===.                 =======================                         
                           =:     :==:          .==========================                         
                           =:        .==-    :=============================                         
                           =:           .==================================                         
                           =:             ===============================:                          
                           =:             ============================.                             
                           =:             =========================.                                
                           =:             ======================                                    
                          .==.            ==================-                                       
                       :==: .===.         ===============:                                          
                    -==.        ===       ============:                                             
                .-==.              -==:   =========.                                                
             .===.                    :==:======.                                                   
           :==.                          -===                                                       
           :=:===.                    :=====                                                        
           :=   .===.             .-========                                                        
           :=      .===:       .============                                                        
           :=          ===: :===============                                                        
           :=             :=================            .===:                                       
           :=              =================         .==-.  .==-                                    
           :=              =================      :==-         .===                                 
           :=              =================   :==:               .-==.                             
           :=              =================-==.                     .-==.                          
           :==:            ==================:                         .===                         
           := :==-         ================= :==:                   .======                         
           :=    .==-.     =================    .==-.            :=========                         
           :=       .===.  =================       .===.      :============                         
           :=           -===================           ===.================                         
           :=              =================            -==================                         
           :=              =================        .-=====================                         
           :=              =================     .=========================                         
           :=              =================  .============================                         
           :=              ================================================                         
            -==.           ===============================================.                         
               :==:        =============. =============================.                            
                  :==:     ==========.    ==========================.                               
                     .==-. ======:.       ======================-.                                  
                        .=====:           ===================:                                      
                           .===.          ================:                                         
                               -==.       =============.                                            
                                  :==:    ==========.                                               
                                     .==- =======                                                   
                                        .====-`;

const LOGO_LINES = CONSTRUCTIVE_LOGO.split('\n').filter(line => line.length > 0);

interface AnimationState {
  phase: 'loading' | 'revealing' | 'complete' | 'color-wave';
  frame: number;
  revealLine: number;
  colorOffset: number;
}

function colorizeChar(char: string, index: number, lineIndex: number, colorOffset: number): string {
  if (char === ' ' || char === '') return char;
  
  // Create a wave effect based on position and offset
  const wave = Math.sin((index + lineIndex + colorOffset) * 0.15);
  
  if (wave > 0.5) {
    return cyan(char);
  } else if (wave > 0) {
    return blue(char);
  } else if (wave > -0.5) {
    return magenta(char);
  } else {
    return green(char);
  }
}

function renderLogoWithColorWave(lines: string[], colorOffset: number): string[] {
  return lines.map((line, lineIndex) => {
    return line.split('').map((char, charIndex) => 
      colorizeChar(char, charIndex, lineIndex, colorOffset)
    ).join('');
  });
}

async function main() {
  console.log('\n');
  
  // Phase 1: Loading spinner
  const spinner = createSpinner('Initializing Constructive...');
  spinner.start();
  await sleep(1500);
  spinner.text('Loading components...');
  await sleep(1000);
  spinner.text('Building interface...');
  await sleep(1000);
  spinner.succeed('Ready!');
  
  await sleep(500);
  console.log('\n');

  // Phase 2: Reveal animation using UIEngine
  const engine = new UIEngine();
  
  await engine.run<AnimationState, void>({
    initialState: {
      phase: 'revealing',
      frame: 0,
      revealLine: 0,
      colorOffset: 0,
    },
    hideCursor: true,
    tickInterval: 30,
    
    render: (state) => {
      const lines: string[] = [];
      
      if (state.phase === 'revealing') {
        // Reveal lines one by one with a gradient effect
        for (let i = 0; i < state.revealLine && i < LOGO_LINES.length; i++) {
          const distanceFromBottom = state.revealLine - i;
          if (distanceFromBottom <= 3) {
            // Fade in effect for recently revealed lines
            lines.push(dim(LOGO_LINES[i]));
          } else {
            lines.push(cyan(LOGO_LINES[i]));
          }
        }
        // Pad remaining lines
        for (let i = state.revealLine; i < LOGO_LINES.length; i++) {
          lines.push('');
        }
      } else if (state.phase === 'color-wave') {
        // Color wave animation
        lines.push(...renderLogoWithColorWave(LOGO_LINES, state.colorOffset));
      } else {
        // Complete - static colored logo
        lines.push(...LOGO_LINES.map(line => cyan(line)));
      }
      
      // Add title and info
      lines.push('');
      lines.push(white('                                            C O N S T R U C T I V E'));
      lines.push(dim('                                       Database-first development platform'));
      lines.push('');
      
      if (state.phase === 'complete') {
        lines.push(dim('                                         Press any key to exit...'));
      } else if (state.phase === 'color-wave') {
        lines.push(dim('                                         Press SPACE to stop animation'));
      }
      
      return lines;
    },
    
    onEvent: (event, state) => {
      if (event.type === 'tick') {
        if (state.phase === 'revealing') {
          // Reveal 2 lines per tick for faster animation
          const newRevealLine = Math.min(state.revealLine + 2, LOGO_LINES.length);
          
          if (newRevealLine >= LOGO_LINES.length) {
            // Move to color wave phase
            return {
              state: {
                ...state,
                phase: 'color-wave',
                revealLine: LOGO_LINES.length,
                colorOffset: 0,
              }
            };
          }
          
          return {
            state: {
              ...state,
              revealLine: newRevealLine,
              frame: state.frame + 1,
            }
          };
        } else if (state.phase === 'color-wave') {
          // Animate color wave
          return {
            state: {
              ...state,
              colorOffset: state.colorOffset + 1,
              frame: state.frame + 1,
            }
          };
        }
        
        return { state };
      }
      
      if (event.type === 'key') {
        if (state.phase === 'color-wave' && event.key === Key.SPACE) {
          return {
            state: { ...state, phase: 'complete' }
          };
        }
        
        if (state.phase === 'complete') {
          return { state, done: true };
        }
      }
      
      if (event.type === 'char') {
        if (state.phase === 'complete') {
          return { state, done: true };
        }
      }
      
      return { state };
    },
  });
  
  engine.destroy();
  
  console.log('\n');
  console.log(green('  Thanks for using Constructive!'));
  console.log(dim('  https://github.com/constructive-io/constructive'));
  console.log('\n');
}

main().catch(console.error);
