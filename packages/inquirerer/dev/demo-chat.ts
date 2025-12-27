#!/usr/bin/env node
/**
 * Demo: Chat AI Prompt Box with Streaming
 * 
 * Run with: pnpm dev:chat
 * Or: npx ts-node dev/demo-chat.ts
 */

import { createStream, createSpinner } from '../src/ui';
import { cyan, dim, green, white } from 'yanse';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simulated AI responses
const AI_RESPONSES = [
  "Hello! I'm an AI assistant. I can help you with coding questions, explain concepts, or assist with various tasks. What would you like to know?",
  "TypeScript is a strongly typed programming language that builds on JavaScript. It adds optional static typing and class-based object-oriented programming to the language. Here are some key benefits:\n\n1. **Type Safety**: Catch errors at compile time rather than runtime\n2. **Better IDE Support**: Enhanced autocomplete and refactoring\n3. **Improved Readability**: Types serve as documentation\n4. **Modern Features**: Access to latest ECMAScript features",
  "Here's a simple example of a TypeScript function:\n\n```typescript\nfunction greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n\nconst message = greet('World');\nconsole.log(message); // Output: Hello, World!\n```\n\nThe `: string` after the parameter and function declaration specifies the types.",
];

/**
 * Simulate streaming text character by character
 */
async function streamText(stream: ReturnType<typeof createStream>, text: string) {
  const words = text.split(' ');
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Add word character by character for realistic effect
    for (const char of word) {
      stream.append(char);
      await sleep(15 + Math.random() * 25); // Variable typing speed
    }
    
    // Add space after word (except last)
    if (i < words.length - 1) {
      stream.append(' ');
      await sleep(10);
    }
  }
}

async function main() {
  console.log('\n' + white('═'.repeat(60)));
  console.log(white('  🤖 AI Chat Demo - Streaming Response Simulation'));
  console.log(white('═'.repeat(60)) + '\n');

  for (let i = 0; i < AI_RESPONSES.length; i++) {
    const response = AI_RESPONSES[i];
    
    // Show user prompt
    console.log(cyan('You: ') + dim(`[Question ${i + 1}]`));
    console.log('');
    
    // Show thinking spinner
    const thinking = createSpinner('Thinking...', { interval: 80 });
    thinking.start();
    await sleep(800 + Math.random() * 500);
    thinking.stop('info', 'Generating response...');
    
    // Stream the response
    console.log('');
    const stream = createStream({ prefix: green('AI: ') });
    stream.start();
    
    await streamText(stream, response);
    
    stream.done();
    console.log('\n' + dim('─'.repeat(60)) + '\n');
    
    await sleep(500);
  }

  console.log(white('═'.repeat(60)));
  console.log(white('  ✨ Demo complete!'));
  console.log(white('═'.repeat(60)) + '\n');
}

main().catch(console.error);
