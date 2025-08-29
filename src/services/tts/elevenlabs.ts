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
    
    console.log(`[ElevenLabs] Initializing with voice ID: ${this.voiceId}, model: ${this.model}`);
    
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
    
    console.log(`[ElevenLabs] Converting text to speech - Voice: ${this.voiceId}, Length: ${text.length} chars`);
    if (text.length > 100) {
      console.log(`[ElevenLabs] Text preview: ${text.substring(0, 100)}...`);
    } else {
      console.log(`[ElevenLabs] Full text: ${text}`);
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
    } catch (error: any) {
      console.error('[ElevenLabs] TTS Error:', error);
      
      // Log more details about the error
      if (error.response) {
        console.error('[ElevenLabs] Response status:', error.response.status);
        console.error('[ElevenLabs] Response data:', error.response.data);
        
        // Check for rate limiting
        if (error.response.status === 429) {
          console.error('[ElevenLabs] RATE LIMITED - Too many requests');
          const retryAfter = error.response.headers?.['retry-after'];
          if (retryAfter) {
            console.error(`[ElevenLabs] Retry after: ${retryAfter} seconds`);
          }
        } else if (error.response.status === 401) {
          console.error('[ElevenLabs] UNAUTHORIZED - Check API key');
        } else if (error.response.status === 400) {
          console.error('[ElevenLabs] BAD REQUEST - Check text length or format');
        }
      }
      
      if (error.message) {
        console.error('[ElevenLabs] Error message:', error.message);
      }
      
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