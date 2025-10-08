#!/usr/bin/env node

/**
 * Test script for emoji filter
 */

import { EmojiFilter } from '../dist/server/filters/emoji-filter.js'

function testEmojiFilter() {
  const filter = new EmojiFilter()

  const testCases = [
    {
      input: 'Hello Michael! 😊 This is amazing! 🎉',
      expected: 'Hello Michael! This is amazing!',
    },
    {
      input: "I love working with you! 💕🥰 You're the best!",
      expected: "I love working with you! You're the best!",
    },
    {
      input: 'Testing flags 🇺🇸 and complex emojis 👨‍👩‍👧‍👦',
      expected: 'Testing flags and complex emojis',
    },
    {
      input: 'Simple text without emojis',
      expected: 'Simple text without emojis',
    },
    {
      input: '✨ Sparkles ✨ everywhere ✨',
      expected: 'Sparkles everywhere',
    },
  ]

  console.log('Testing Emoji Filter:\n')

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

testEmojiFilter()
