import { ElevenLabsClient, play } from '@elevenlabs/elevenlabs-js';
import { BaseTTSService } from './base';
import { TTSServiceConfig } from '../../types/config';

export class ElevenLabsTTSService extends BaseTTSService {
  private client: ElevenLabsClient | null = null;
  private voiceId: string;
  private model: string;
  private stability: number;
  private similarityBoost: number;
  
  constructor(config: TTSServiceConfig) {
    super(config);
    
    this.voiceId = config.voiceId || 'EXAVITQu4vr4xnSDxMaL'; // Default voice
    this.model = config.model || 'eleven_turbo_v2_5'; // Use turbo v2.5 by default
    this.stability = config.options?.stability || 0.5;
    this.similarityBoost = config.options?.similarityBoost || 0.75;
    
    if (this.apiKey) {
      this.client = new ElevenLabsClient({
        apiKey: this.apiKey
      });
    }
  }
  
  async tts(text: string): Promise<void> {
    if (!this.client) {
      throw new Error('ElevenLabs client not initialized. Please provide an API key.');
    }
    
    try {
      const audioStream = await this.client.textToSpeech.convert(this.voiceId, {
        text,
        modelId: this.model,
        outputFormat: 'mp3_44100_128',
        voiceSettings: {
          stability: this.stability,
          similarityBoost: this.similarityBoost
        }
      });
      
      // Convert ReadableStream to an async iterable
      const audioIterable = this.streamToAsyncIterable(audioStream);
      await play(audioIterable);
    } catch (error) {
      console.error('ElevenLabs TTS Error:', error);
      throw error;
    }
  }
  
  isAvailable(): boolean {
    return !!this.client && !!this.apiKey;
  }
  
  private async *streamToAsyncIterable(stream: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
    const reader = stream.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }
}