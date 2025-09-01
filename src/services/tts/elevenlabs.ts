import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { BaseTTSService } from './base.js';
import { TTSServiceConfig } from '../../types/config.js';
import { spawn, ChildProcess } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export class ElevenLabsTTSService extends BaseTTSService {
  private client: ElevenLabsClient | null = null;
  private voiceId: string;
  private model: string;
  private stability: number;
  private similarityBoost: number;
  private currentAudioProcess: ChildProcess | null = null;
  private currentTempFile: string | null = null;
  
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
      await this.playAudio(tempFile);
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
  
  private async playAudio(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use afplay on macOS, aplay on Linux, or cmdmp3 on Windows
      const platform = process.platform;
      let command: string;
      let args: string[];
      
      if (platform === 'darwin') {
        command = 'afplay';
        args = [filePath];
      } else if (platform === 'linux') {
        command = 'aplay';
        args = [filePath];
      } else if (platform === 'win32') {
        command = 'powershell';
        args = ['-c', `(New-Object Media.SoundPlayer '${filePath}').PlaySync()`];
      } else {
        reject(new Error(`Unsupported platform: ${platform}`));
        return;
      }
      
      console.log(`[ElevenLabs] Playing audio with ${command}`);
      this.currentAudioProcess = spawn(command, args);
      
      this.currentAudioProcess.on('close', async (code) => {
        console.log(`[ElevenLabs] Audio playback finished with code ${code}`);
        this.currentAudioProcess = null;
        
        // Clean up temp file
        if (this.currentTempFile) {
          try {
            await unlink(this.currentTempFile);
            console.log(`[ElevenLabs] Cleaned up temp file: ${this.currentTempFile}`);
          } catch (err) {
            console.error(`[ElevenLabs] Failed to delete temp file: ${err}`);
          }
          this.currentTempFile = null;
        }
        
        if (code === 0) {
          resolve();
        } else if (code !== null) {
          // code is null when process is killed, which is expected for stop()
          reject(new Error(`Audio playback failed with code ${code}`));
        } else {
          // Process was killed (stopped)
          resolve();
        }
      });
      
      this.currentAudioProcess.on('error', (err) => {
        console.error(`[ElevenLabs] Audio playback error: ${err}`);
        this.currentAudioProcess = null;
        reject(err);
      });
    });
  }
  
  stop(): void {
    if (this.currentAudioProcess) {
      console.log('[ElevenLabs] Stopping audio playback');
      this.currentAudioProcess.kill();
      this.currentAudioProcess = null;
    }
    
    // Clean up temp file if it exists
    if (this.currentTempFile) {
      unlink(this.currentTempFile).catch(err => {
        console.error(`[ElevenLabs] Failed to delete temp file during stop: ${err}`);
      });
      this.currentTempFile = null;
    }
  }
}