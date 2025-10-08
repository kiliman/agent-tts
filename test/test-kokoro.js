#!/usr/bin/env node

/**
 * Test script for Kokoro TTS integration
 *
 * Usage: node test/test-kokoro.js
 *
 * Requires Kokoro to be running on localhost:8880
 */

import { KokoroTTSService } from '../dist/server/services/tts/kokoro.js'

async function testKokoro() {
  console.log('Testing Kokoro TTS integration...\n')

  const config = {
    type: 'kokoro',
    baseUrl: 'http://localhost:8880/v1',
    voiceId: 'af_bella', // American Female (Bella voice)
    apiKey: 'local', // No API key needed for local instance
    options: {
      speed: 1.0,
      responseFormat: 'mp3',
    },
  }

  const tts = new KokoroTTSService(config)

  if (!tts.isAvailable()) {
    console.error('❌ Kokoro TTS service is not available')
    process.exit(1)
  }

  console.log('✅ Kokoro TTS service is available')
  console.log(`📍 Using Kokoro at: ${config.baseUrl}`)
  console.log(`🎤 Voice: ${config.voiceId}`)
  console.log()

  const testMessages = [
    'Hello Michael! This is Claudia testing the Kokoro TTS integration.',
    'Kokoro provides high-quality, local text-to-speech without cloud dependencies.',
    'Perfect for when you want to save on API costs!',
  ]

  for (const message of testMessages) {
    console.log(`🔊 Speaking: "${message}"`)
    try {
      await tts.tts(message)
      console.log('✅ Success!\n')

      // Wait a bit between messages
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.error('❌ Error:', error.message)
      console.error('\nMake sure Kokoro is running on localhost:8880')
      process.exit(1)
    }
  }

  console.log('🎉 All tests passed! Kokoro integration is working.')
}

testKokoro().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
