import { TTSServiceConfig } from '../../types/config';
import { BaseTTSService } from './base';
import { ElevenLabsTTSService } from './elevenlabs';

export class TTSServiceFactory {
  static create(config: TTSServiceConfig): BaseTTSService {
    switch (config.type) {
      case 'elevenlabs':
        return new ElevenLabsTTSService(config);
      case 'openai':
        throw new Error('OpenAI TTS service not yet implemented');
      case 'custom':
        throw new Error('Custom TTS service not yet implemented');
      default:
        throw new Error(`Unknown TTS service type: ${config.type}`);
    }
  }
}