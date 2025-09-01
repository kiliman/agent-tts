import { BaseTTSService } from './base.js';
import { TTSServiceConfig } from '../../types/config.js';
import { spawn, ChildProcess } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import axios from 'axios';

export class OpenAITTSService extends BaseTTSService {
  protected baseUrl: string;
  protected voiceId: string;
  protected model: string;
  protected speed: number;
  protected responseFormat: string;
  private currentAudioProcess: ChildProcess | null = null;
  private currentTempFile: string | null = null;
  
  constructor(config: TTSServiceConfig) {
    super(config);
    
    // Support custom base URLs for OpenAI-compatible services (like Kokoro)
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.voiceId = config.voiceId || 'alloy';
    this.model = config.model || 'tts-1';
    this.speed = config.options?.speed || 1.0;
    this.responseFormat = config.options?.responseFormat || 'mp3';
    
    console.log(`[OpenAI] Initializing with base URL: ${this.baseUrl}, voice: ${this.voiceId}, model: ${this.model}`);
  }
  
  async tts(text: string): Promise<void> {
    if (!this.apiKey) {
      throw new Error('OpenAI-compatible service requires an API key');
    }
    
    // Stop any currently playing audio
    this.stop();
    
    console.log(`[OpenAI] Converting text to speech - Voice: ${this.voiceId}, Length: ${text.length} chars`);
    if (text.length > 100) {
      console.log(`[OpenAI] Text preview: ${text.substring(0, 100)}...`);
    } else {
      console.log(`[OpenAI] Full text: ${text}`);
    }
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/audio/speech`,
        {
          model: this.model,
          input: text,
          voice: this.voiceId,
          speed: this.speed,
          response_format: this.responseFormat
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );
      
      // Save to temp file
      const extension = this.responseFormat === 'opus' ? 'opus' : 
                       this.responseFormat === 'aac' ? 'aac' : 
                       this.responseFormat === 'flac' ? 'flac' : 
                       this.responseFormat === 'wav' ? 'wav' : 
                       this.responseFormat === 'pcm' ? 'pcm' : 'mp3';
      const tempFile = join(tmpdir(), `tts-${Date.now()}.${extension}`);
      await writeFile(tempFile, Buffer.from(response.data));
      this.currentTempFile = tempFile;
      
      // Play using afplay (macOS) or other platform-specific player
      await this.playAudio(tempFile);
    } catch (error: any) {
      // Extract useful error information without dumping entire request object
      let errorMessage = 'TTS request failed';
      let errorDetails: any = {};
      
      if (error.response) {
        errorDetails.status = error.response.status;
        
        // Try to parse error response body
        if (error.response.data) {
          try {
            // If data is a buffer, convert to string
            const responseData = Buffer.isBuffer(error.response.data) 
              ? JSON.parse(error.response.data.toString())
              : error.response.data;
            
            if (responseData.detail) {
              errorDetails.detail = responseData.detail;
              if (responseData.detail.message) {
                errorMessage = responseData.detail.message;
              }
            } else if (responseData.error) {
              errorDetails.error = responseData.error;
              errorMessage = typeof responseData.error === 'string' 
                ? responseData.error 
                : responseData.error.message || errorMessage;
            }
          } catch {
            // If we can't parse the response, just use the status code
            errorDetails.rawResponse = error.response.data?.toString?.().substring(0, 200);
          }
        }
        
        // Add helpful context based on status code
        if (error.response.status === 429) {
          errorMessage = 'Rate limited - too many requests';
        } else if (error.response.status === 401) {
          errorMessage = 'Unauthorized - check API key';
        } else if (error.response.status === 400) {
          errorMessage = errorMessage || 'Bad request - check parameters';
        }
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = `Cannot connect to TTS service at ${this.baseUrl}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      console.error(`[OpenAI] TTS Error: ${errorMessage}`);
      if (Object.keys(errorDetails).length > 0) {
        console.error('[OpenAI] Error details:', errorDetails);
      }
      
      // Throw a clean error message instead of the entire axios error
      const cleanError = new Error(errorMessage);
      (cleanError as any).details = errorDetails;
      throw cleanError;
    }
  }
  
  isAvailable(): boolean {
    return !!this.apiKey;
  }
  
  private async playAudio(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const platform = process.platform;
      let command: string;
      let args: string[];
      
      if (platform === 'darwin') {
        command = 'afplay';
        args = [filePath];
      } else if (platform === 'linux') {
        // For Linux, try multiple players in order of preference
        // We'll use ffplay as it supports more formats
        command = 'ffplay';
        args = ['-nodisp', '-autoexit', filePath];
      } else if (platform === 'win32') {
        command = 'powershell';
        args = ['-c', `(New-Object Media.SoundPlayer '${filePath}').PlaySync()`];
      } else {
        reject(new Error(`Unsupported platform: ${platform}`));
        return;
      }
      
      console.log(`[OpenAI] Playing audio with ${command}`);
      this.currentAudioProcess = spawn(command, args);
      
      this.currentAudioProcess.on('close', async (code) => {
        console.log(`[OpenAI] Audio playback finished with code ${code}`);
        this.currentAudioProcess = null;
        
        // Clean up temp file
        if (this.currentTempFile) {
          try {
            await unlink(this.currentTempFile);
            console.log(`[OpenAI] Cleaned up temp file: ${this.currentTempFile}`);
          } catch (err) {
            console.error(`[OpenAI] Failed to delete temp file: ${err}`);
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
        console.error(`[OpenAI] Audio playback error: ${err}`);
        this.currentAudioProcess = null;
        reject(err);
      });
    });
  }
  
  stop(): void {
    if (this.currentAudioProcess) {
      console.log('[OpenAI] Stopping audio playback');
      this.currentAudioProcess.kill();
      this.currentAudioProcess = null;
    }
    
    // Clean up temp file if it exists
    if (this.currentTempFile) {
      unlink(this.currentTempFile).catch(err => {
        console.error(`[OpenAI] Failed to delete temp file during stop: ${err}`);
      });
      this.currentTempFile = null;
    }
  }
}