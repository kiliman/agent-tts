import { OpenAITTSService } from './openai.js';
import { TTSServiceConfig } from '../../types/config.js';

/**
 * Kokoro TTS Service
 * 
 * Kokoro is an open-source TTS system that provides an OpenAI-compatible API.
 * It runs locally and offers high-quality voice synthesis without cloud dependencies.
 * 
 * Default configuration assumes Kokoro is running locally on port 8080.
 * Voice IDs in Kokoro follow patterns like:
 * - af_bella, af_nicole, af_sarah (American Female voices)
 * - am_adam, am_michael, am_echo (American Male voices) 
 * - bf_emma, bf_alice, bf_lily (British Female voices)
 * - bm_george, bm_daniel, bm_lewis (British Male voices)
 */
export class KokoroTTSService extends OpenAITTSService {
  constructor(config: TTSServiceConfig) {
    // Set Kokoro-specific defaults
    const kokoroConfig = {
      ...config,
      // Default to local Kokoro instance
      baseUrl: config.baseUrl || 'http://localhost:8880/v1',
      // Default voice - American Female (Bella)
      voiceId: config.voiceId || 'af_bella',
      // Kokoro uses 'kokoro' as the model name
      model: config.model || 'kokoro',
      // Override API key requirement for local instances
      apiKey: config.apiKey || 'local',
      options: {
        ...config.options,
        // Kokoro supports speed adjustment
        speed: config.options?.speed || 1.0,
        // Default to MP3 format
        responseFormat: config.options?.responseFormat || 'mp3'
      }
    };
    
    super(kokoroConfig);
    
    console.log(`[Kokoro] Initialized with local instance at ${this.baseUrl}`);
    console.log(`[Kokoro] Using voice: ${this.voiceId}`);
  }
  
  isAvailable(): boolean {
    // For local Kokoro, we don't strictly need an API key
    // Just check if we have a base URL configured
    return !!this.baseUrl;
  }
}