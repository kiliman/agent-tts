#!/usr/bin/env node

/**
 * Test script for configurable pronunciation filter
 */

import { PronunciationFilter } from '../dist/server/filters/pronunciation-filter.js';

function testConfigurablePronunciation() {
  console.log('Testing Configurable Pronunciation Filter:\n');
  
  // Test 1: Default replacements work
  console.log('Test 1: Default replacements');
  const defaultFilter = new PronunciationFilter();
  const message1 = {
    role: 'assistant',
    content: 'Use git to manage your npm packages'
  };
  const result1 = defaultFilter.filter(message1);
  console.log(`Input:  "${message1.content}"`);
  console.log(`Output: "${result1.content}"`);
  console.log(`Expected: "Use  ghit  to manage your  N P M  packages"`);
  console.log(`Pass: ${result1.content.includes('ghit') && result1.content.includes('N P M')}\n`);
  
  // Test 2: Custom replacements override defaults
  console.log('Test 2: Custom replacements override defaults');
  const customFilter = new PronunciationFilter({
    'git': 'get',  // Override default
    'beehiiv': 'bee hive',  // Add new
    'claude': 'clawed'  // Add new
  });
  const message2 = {
    role: 'assistant', 
    content: 'Claude uses git to deploy to beehiiv'
  };
  const result2 = customFilter.filter(message2);
  console.log(`Input:  "${message2.content}"`);
  console.log(`Output: "${result2.content}"`);
  console.log(`Expected should contain: "clawed", "get", "bee hive"`);
  console.log(`Pass: ${result2.content.includes('clawed') && result2.content.includes('get') && result2.content.includes('bee hive')}\n`);
  
  // Test 3: Add new pronunciations without removing defaults
  console.log('Test 3: Adding new pronunciations keeps defaults');
  const addFilter = new PronunciationFilter({
    'anthropic': 'ann throw pick',
    'openai': 'open A I'
  });
  const message3 = {
    role: 'assistant',
    content: 'Anthropic and OpenAI both provide TTS via API'
  };
  const result3 = addFilter.filter(message3);
  console.log(`Input:  "${message3.content}"`);
  console.log(`Output: "${result3.content}"`);
  console.log(`Should contain: "ann throw pick", "open A I", "tee-tee-ess", "A P I"`);
  const hasAll = result3.content.includes('ann throw pick') && 
                 result3.content.includes('open A I') &&
                 result3.content.includes('tee-tee-ess') &&
                 result3.content.includes('A P I');
  console.log(`Pass: ${hasAll}\n`);
  
  // Test 4: Case insensitive
  console.log('Test 4: Case insensitive matching');
  const caseFilter = new PronunciationFilter({
    'API': 'application interface'  // Different from default
  });
  const message4 = {
    role: 'assistant',
    content: 'The API and api are the same'
  };
  const result4 = caseFilter.filter(message4);
  console.log(`Input:  "${message4.content}"`);
  console.log(`Output: "${result4.content}"`);
  console.log(`Both "API" and "api" should be replaced`);
  const count = (result4.content.match(/application interface/g) || []).length;
  console.log(`Pass: ${count === 2}\n`);
  
  console.log('All tests completed!');
}

testConfigurablePronunciation();