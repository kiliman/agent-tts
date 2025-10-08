#!/usr/bin/env node

/**
 * Test script for URL filter
 */

import { UrlFilter } from '../dist/server/filters/url-filter.js'

function testUrlFilter() {
  const filter = new UrlFilter()

  const testCases = [
    {
      input: 'Check out this link: https://www.google.com/search?q=hello+world',
      expected: 'Check out this link: URL',
    },
    {
      input: 'Visit http://localhost:3456 for the dashboard',
      expected: 'Visit URL for the dashboard',
    },
    {
      input: 'The docs are at https://docs.anthropic.com/en/docs/claude-code/',
      expected: 'The docs are at URL',
    },
    {
      input: 'Multiple URLs: https://github.com and http://npmjs.com are useful',
      expected: 'Multiple URLs: URL and URL are useful',
    },
    {
      input: 'Simple text without any URLs',
      expected: 'Simple text without any URLs',
    },
    {
      input: 'File URL: file:///Users/michael/Projects/oss/agent-tts/README.md',
      expected: 'File URL: URL',
    },
    {
      input: 'FTP link: ftp://ftp.mozilla.org/pub/',
      expected: 'FTP link: URL',
    },
    {
      input: 'Just www: www.example.com is also a URL',
      expected: 'Just www: URL is also a URL',
    },
  ]

  console.log('Testing URL Filter:\n')

  let passed = 0
  let failed = 0

  for (const test of testCases) {
    const message = {
      role: 'assistant',
      content: test.input,
    }

    const result = filter.filter(message)
    const filtered = result ? result.content : ''

    if (filtered === test.expected) {
      console.log(`✓ PASS`)
      console.log(`  Input:    "${test.input}"`)
      console.log(`  Output:   "${filtered}"`)
      passed++
    } else {
      console.log(`✗ FAIL`)
      console.log(`  Input:    "${test.input}"`)
      console.log(`  Expected: "${test.expected}"`)
      console.log(`  Got:      "${filtered}"`)
      failed++
    }
    console.log()
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`)

  if (failed > 0) {
    process.exit(1)
  }
}

testUrlFilter()
