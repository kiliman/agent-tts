#!/usr/bin/env node

/**
 * Test script for markdown filter
 */

import { MarkdownFilter } from '../dist/server/filters/markdown-filter.js';

function testMarkdownFilter() {
  const filter = new MarkdownFilter();
  
  const testCases = [
    // Numbered list without periods
    {
      input: `Here are the steps:
1. First step without period
2. Second step also no period
3. Third step ends here`,
      expected: `Here are the steps.
1. First step without period.
2. Second step also no period.
3. Third step ends here.`
    },
    // Bullet list with dashes
    {
      input: `Features include:
- Real-time TTS
- Multi-agent support
- Beautiful UI`,
      expected: `Features include.
Real-time TTS.
Multi-agent support.
Beautiful UI.`
    },
    // Mixed list with some punctuation
    {
      input: `Todo list:
1. Complete the filter implementation.
2. Add tests
3. Update documentation!
4. Deploy`,
      expected: `Todo list.
1. Complete the filter implementation.
2. Add tests.
3. Update documentation!
4. Deploy.`
    },
    // List with asterisks
    {
      input: `Options:
* Option one
* Option two
* Option three`,
      expected: `Options.
Option one.
Option two.
Option three.`
    },
    // List with plus signs
    {
      input: `Benefits:
+ Faster processing
+ Better accuracy
+ Lower cost`,
      expected: `Benefits.
Faster processing.
Better accuracy.
Lower cost.`
    },
    // Markdown with inline code
    {
      input: "Use `npm install` to install dependencies",
      expected: "Use npm install to install dependencies"
    },
    // Headers
    {
      input: "## This is a header\nFollowed by text",
      expected: "This is a header\nFollowed by text"
    },
    // Bold and italic
    {
      input: "This is **bold** and this is *italic*",
      expected: "This is bold and this is italic"
    },
    // Links
    {
      input: "Check out [GitHub](https://github.com)",
      expected: "Check out GitHub"
    },
    // Code blocks
    {
      input: "Here's code:\n```js\nconsole.log('hello');\n```\nAfter code",
      expected: "Here's code:\n\nAfter code"
    },
    // Complex example with multiple elements
    {
      input: `# Project Setup

Follow these steps:
1. Clone the **repository**
2. Run \`npm install\`
3. Configure the [settings](./settings.md)
4. Start with \`npm run dev\`

That's it!`,
      expected: `Project Setup

Follow these steps.
1. Clone the repository.
2. Run npm install.
3. Configure the settings.
4. Start with npm run dev.

That's it!`
    }
  ];
  
  console.log('Testing Markdown Filter:\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    const message = {
      role: 'assistant',
      content: test.input
    };
    
    const result = filter.filter(message);
    const filtered = result ? result.content : '';
    
    if (filtered === test.expected) {
      console.log(`✓ PASS`);
      if (test.input.length > 50) {
        console.log(`  Input:    "${test.input.substring(0, 50)}..."`);
      } else {
        console.log(`  Input:    "${test.input}"`);
      }
      passed++;
    } else {
      console.log(`✗ FAIL`);
      console.log(`  Input:\n${test.input}`);
      console.log(`  Expected:\n${test.expected}`);
      console.log(`  Got:\n${filtered}`);
      failed++;
    }
    console.log();
  }
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

testMarkdownFilter();