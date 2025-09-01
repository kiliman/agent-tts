#!/usr/bin/env node

/**
 * Test script for filepath filter
 */

import { FilepathFilter } from '../dist/server/filters/filepath-filter.js';

function testFilepathFilter() {
  const filter = new FilepathFilter();
  
  const testCases = [
    // Michael's actual example message
    {
      input: `opencode stores chat logs in:

- **macOS/Linux**: \`~/.local/share/opencode/project/\`
- **Windows**: \`%USERPROFILE%\\.local\\share\\opencode\\project\\\`

For Git repositories, logs are stored in \`./\<project-slug\>/storage/\`, otherwise in \`./global/storage/\`.`,
      expected: `opencode stores chat logs in:

- **macOS/Linux**: \`project\`
- **Windows**: \`project\`

For Git repositories, logs are stored in \`storage\`, otherwise in \`global/storage\`.`
    },
    // Individual path tests
    {
      input: "The file is located at `/usr/local/bin/node`",
      expected: "The file is located at `node`"
    },
    {
      input: "Check the config in `~/.agent-tts/index.js`",
      expected: "Check the config in `index.js`"
    },
    {
      input: "Open file at `C:\\Users\\Michael\\Documents\\project.txt`",
      expected: "Open file at `project.txt`"
    },
    {
      input: "Look in `./src/components/Button.tsx` for the component",
      expected: "Look in `Button.tsx` for the component"
    },
    {
      input: "The path (../parent/folder/file.js) contains the code",
      expected: "The path (file.js) contains the code"
    },
    {
      input: "Navigate to `~/Documents/Projects/agent-tts/`",
      expected: "Navigate to `agent-tts`"
    },
    {
      input: "Simple text without any file paths",
      expected: "Simple text without any file paths"
    },
    {
      input: "The ratio is 16/9 and the score is 3/4",
      expected: "The ratio is 16/9 and the score is 3/4"
    }
  ];
  
  console.log('Testing Filepath Filter:\n');
  
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
      if (test.input.length > 100) {
        console.log(`  Input:    "${test.input.substring(0, 50)}..."`);
        console.log(`  Expected: "${test.expected.substring(0, 50)}..."`);
      } else {
        console.log(`  Input:    "${test.input}"`);
        console.log(`  Output:   "${filtered}"`);
      }
      passed++;
    } else {
      console.log(`✗ FAIL`);
      if (test.input.length > 100) {
        console.log(`  Input:    "${test.input.substring(0, 100)}..."`);
        console.log(`  Expected: "${test.expected.substring(0, 100)}..."`);
        console.log(`  Got:      "${filtered.substring(0, 100)}..."`);
      } else {
        console.log(`  Input:    "${test.input}"`);
        console.log(`  Expected: "${test.expected}"`);
        console.log(`  Got:      "${filtered}"`);
      }
      failed++;
    }
    console.log();
  }
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\nDEBUG: Testing individual transformations:');
    
    // Test specific problematic cases
    const debugCases = [
      '`~/.local/share/opencode/project/`',
      '`%USERPROFILE%\\.local\\share\\opencode\\project\\`',
      '`./<project-slug>/storage/`',
      '`./global/storage/`'
    ];
    
    for (const testInput of debugCases) {
      const msg = { role: 'assistant', content: testInput };
      const res = filter.filter(msg);
      console.log(`  "${testInput}" -> "${res.content}"`);
    }
  }
  
  if (failed > 0) {
    process.exit(1);
  }
}

testFilepathFilter();