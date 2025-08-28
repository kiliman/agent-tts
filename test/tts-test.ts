import * as dotenv from 'dotenv';
import { ElevenLabsTTSService } from '../src/services/tts/elevenlabs';
import type { TTSServiceConfig } from '../src/types/config';

dotenv.config();

async function testElevenLabs() {
  const config: TTSServiceConfig = {
    type: 'elevenlabs',
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Sarah voice
    model: 'eleven_turbo_v2_5', // Using turbo v2.5 model
    options: {
      stability: 0.5,
      similarityBoost: 0.75
    }
  };
  
  if (!config.apiKey) {
    console.error('Please set ELEVENLABS_API_KEY in your .env file');
    process.exit(1);
  }
  
  const tts = new ElevenLabsTTSService(config);
  
  if (!tts.isAvailable()) {
    console.error('ElevenLabs TTS service is not available');
    process.exit(1);
  }
  
  console.log('Testing ElevenLabs TTS with eleven_turbo_v2_5 model...');
  
  try {
    await tts.tts('Hello! This is a test of the ElevenLabs text-to-speech service using the eleven turbo v2.5 model.');
    console.log('✅ TTS test successful!');
  } catch (error) {
    console.error('❌ TTS test failed:', error);
  }
}

// Run the test
testElevenLabs().catch(console.error);