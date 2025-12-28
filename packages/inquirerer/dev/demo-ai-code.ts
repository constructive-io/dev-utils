#!/usr/bin/env node
/**
 * Demo: AI Code Assistant Interface
 * 
 * This demo showcases the AICodeUI component which provides a claude-code style
 * terminal interface with:
 * - Diff-based rendering (minimal flicker)
 * - Scrollback preservation (committed messages stay in terminal history)
 * - Streaming text display for AI responses
 * - Line editor for user input
 * - In-app scrolling for chat history
 * 
 * Run with: pnpm dev:ai-code
 */

import { createAICodeUI } from './ai/aicode';
import { white, dim, cyan, green } from 'yanse';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simulated AI responses based on user input
const AI_RESPONSES: Record<string, string> = {
  'hello': "Hello! I'm your AI coding assistant. I can help you with:\n\n- Writing and explaining code\n- Debugging issues\n- Refactoring suggestions\n- Git workflows\n- And much more!\n\nWhat would you like help with today?",
  
  'help': "Here are some things you can ask me:\n\n1. 'explain [code]' - I'll explain how code works\n2. 'write [description]' - I'll write code for you\n3. 'debug [error]' - I'll help debug issues\n4. 'refactor [code]' - I'll suggest improvements\n\nJust type naturally and I'll do my best to help!",
  
  'typescript': "TypeScript is a strongly typed programming language that builds on JavaScript. Here's a quick example:\n\n```typescript\ninterface User {\n  name: string;\n  age: number;\n}\n\nfunction greet(user: User): string {\n  return `Hello, ${user.name}!`;\n}\n```\n\nKey benefits:\n- Type safety catches errors at compile time\n- Better IDE support with autocomplete\n- Self-documenting code through types",
  
  'git': "Here are some useful git commands:\n\n```bash\n# Create a new branch\ngit checkout -b feature/my-feature\n\n# Stage and commit changes\ngit add .\ngit commit -m \"feat: add new feature\"\n\n# Push to remote\ngit push origin feature/my-feature\n\n# Create a PR (using gh cli)\ngh pr create --title \"My Feature\" --body \"Description\"\n```\n\nWant me to explain any of these in more detail?",
  
  'default': "I understand you're asking about that. Let me think...\n\nBased on my analysis, here's what I can tell you:\n\n1. First, consider the context of your question\n2. Then, break down the problem into smaller parts\n3. Finally, apply the appropriate solution\n\nWould you like me to elaborate on any specific aspect?",
};

/**
 * Get a response based on user input
 */
function getResponse(input: string): string {
  const lowerInput = input.toLowerCase();
  
  for (const [key, response] of Object.entries(AI_RESPONSES)) {
    if (key !== 'default' && lowerInput.includes(key)) {
      return response;
    }
  }
  
  return AI_RESPONSES['default'];
}

/**
 * Simulate streaming text character by character
 */
async function streamResponse(ui: ReturnType<typeof createAICodeUI>, text: string): Promise<void> {
  ui.startStream('assistant');
  
  const words = text.split(' ');
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Stream word character by character for realistic effect
    for (const char of word) {
      ui.appendStream(char);
      await sleep(15 + Math.random() * 25); // Variable typing speed
    }
    
    // Add space after word (except last)
    if (i < words.length - 1) {
      ui.appendStream(' ');
      await sleep(10);
    }
  }
  
  // Small delay before ending stream
  await sleep(100);
  ui.endStream();
}

/**
 * Main demo function
 */
async function main() {
  // Print welcome banner (this goes to scrollback)
  console.log('\n' + white('═'.repeat(60)));
  console.log(white('  AI Code Assistant Demo'));
  console.log(white('  Powered by inquirerer ViewportRenderer'));
  console.log(white('═'.repeat(60)));
  console.log(dim('  This demo showcases diff-based terminal rendering'));
  console.log(dim('  with scrollback preservation.'));
  console.log('');
  console.log(cyan('  Commands:'));
  console.log(dim('  - Type a message and press Enter to chat'));
  console.log(dim('  - Use UP/DOWN arrows to scroll through history'));
  console.log(dim('  - Press Ctrl+C to exit'));
  console.log('');
  console.log(green('  Try: "hello", "help", "typescript", or "git"'));
  console.log(white('═'.repeat(60)) + '\n');
  
  // Create the AI Code UI
  const ui = createAICodeUI({
    title: 'AI Code Assistant',
    promptPrefix: '> ',
    viewportHeight: 14,
    
    onSubmit: async (input) => {
      // Simulate thinking delay
      await sleep(300 + Math.random() * 500);
      
      // Get and stream the response
      const response = getResponse(input);
      await streamResponse(ui, response);
    },
    
    onExit: () => {
      console.log('\n' + dim('Goodbye! Thanks for trying the AI Code Assistant demo.') + '\n');
      process.exit(0);
    },
  });
  
  // Start the UI
  ui.start();
  
  // Add initial system message
  ui.addMessage('system', 'Welcome! Type a message below to start chatting.');
}

// Run the demo
main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
