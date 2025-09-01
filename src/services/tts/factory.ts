import { TTSServiceConfig } from '../../types/config.js';
import { BaseTTSService } from './base.js';
import { ElevenLabsTTSService } from './elevenlabs.js';
import { OpenAITTSService } from './openai.js';
import { KokoroTTSService } from './kokoro.js';

export class TTSServiceFactory {
  static create(config: TTSServiceConfig): BaseTTSService {
    switch (config.type) {
      case 'elevenlabs':
        return new ElevenLabsTTSService(config);
      case 'openai':
        return new OpenAITTSService(config);
      case 'kokoro':
        return new KokoroTTSService(config);
      case 'openai-compatible':
        // For any OpenAI-compatible service (requires baseUrl)
        return new OpenAITTSService(config);
      case 'custom':
        throw new Error('Custom TTS service not yet implemented');
      default:
        throw new Error(`Unknown TTS service type: ${config.type}`);
    }
  }
}