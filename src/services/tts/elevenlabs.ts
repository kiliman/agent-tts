import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { BaseTTSService } from './base.js';
import { TTSServiceConfig } from '../../types/config.js';
import { writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

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
    
    // Stop any currently playing audio
    this.stop();
    
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
      
      // Convert stream to buffer
      const audioBuffer = await this.streamToBuffer(audioStream);
      
      // Save to temp file
      const tempFile = join(tmpdir(), `tts-${Date.now()}.mp3`);
      await writeFile(tempFile, audioBuffer);
      this.currentTempFile = tempFile;
      
      // Play using afplay (macOS) or other platform-specific player
      await this.playAudio(tempFile, 'ElevenLabs');
    } catch (error: any) {
      // Extract useful error information without dumping entire request object
      let errorMessage = 'TTS request failed';
      let errorDetails: any = {};
      
      if (error.response) {
        errorDetails.status = error.response.status;
        
        // Try to extract meaningful error message
        if (error.response.data) {
          if (typeof error.response.data === 'string') {
            errorMessage = error.response.data;
          } else if (error.response.data.detail) {
            errorMessage = error.response.data.detail.message || error.response.data.detail;
          } else if (error.response.data.error) {
            errorMessage = error.response.data.error;
          }
        }
        
        // Add helpful context based on status code
        if (error.response.status === 429) {
          errorMessage = 'Rate limited - too many requests';
          const retryAfter = error.response.headers?.['retry-after'];
          if (retryAfter) {
            errorDetails.retryAfter = `${retryAfter} seconds`;
          }
        } else if (error.response.status === 401) {
          errorMessage = 'Unauthorized - check ElevenLabs API key';
        } else if (error.response.status === 400) {
          errorMessage = errorMessage || 'Bad request - check text length or voice ID';
        } else if (error.response.status === 422) {
          errorMessage = 'Invalid voice ID or parameters';
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      console.error(`[ElevenLabs] TTS Error: ${errorMessage}`);
      if (Object.keys(errorDetails).length > 0) {
        console.error('[ElevenLabs] Error details:', errorDetails);
      }
      
      // Throw a clean error message instead of the entire error object
      const cleanError = new Error(errorMessage);
      (cleanError as any).details = errorDetails;
      throw cleanError;
    }
  }
  
  isAvailable(): boolean {
    return !!this.client && !!this.apiKey;
  }
  
  private async streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    
    // Combine all chunks into a single buffer
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const buffer = Buffer.allocUnsafe(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    
    return buffer;
  }
  
}