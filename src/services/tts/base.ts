import { spawn, ChildProcess } from 'child_process';
import { unlink, mkdir, copyFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

export abstract class BaseTTSService {
  protected apiKey: string;
  protected currentAudioProcess: ChildProcess | null = null;
  protected currentTempFile: string | null = null;
  
  constructor(protected config: any) {
    this.apiKey = config.apiKey || '';
  }
  
  protected async saveAudioFile(tempFile: string, profile: string, timestamp: Date): Promise<string | undefined> {
    try {
      // Create directory structure: ~/.agent-tts/audio/YYYY-MM-DD/
      const audioBaseDir = join(homedir(), '.agent-tts', 'audio');
      const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
      const audioDir = join(audioBaseDir, dateStr);
      
      // Ensure directory exists
      await mkdir(audioDir, { recursive: true });
      
      // Create filename: profile-id-timestamp.mp3
      const epochTimestamp = Math.floor(timestamp.getTime() / 1000);
      const extension = tempFile.split('.').pop() || 'mp3';
      const filename = `${profile}-${epochTimestamp}.${extension}`;
      const destPath = join(audioDir, filename);
      
      // Copy temp file to permanent location
      await copyFile(tempFile, destPath);
      console.log(`[TTS] Saved audio to: ${destPath}`);
      
      return destPath;
    } catch (err) {
      console.error('[TTS] Failed to save audio file:', err);
      return undefined;
    }
  }
  
  abstract tts(text: string, metadata?: { profile?: string; timestamp?: Date }): Promise<void>;
  abstract isAvailable(): boolean;
  
  protected async playAudio(filePath: string, serviceName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const platform = process.platform;
      let command: string;
      let args: string[];
      
      if (platform === 'darwin') {
        command = 'afplay';
        args = [filePath];
      } else if (platform === 'linux') {
        // For Linux, try ffplay as it supports more formats
        command = 'ffplay';
        args = ['-nodisp', '-autoexit', filePath];
      } else if (platform === 'win32') {
        command = 'powershell';
        args = ['-c', `(New-Object Media.SoundPlayer '${filePath}').PlaySync()`];
      } else {
        reject(new Error(`Unsupported platform: ${platform}`));
        return;
      }
      
      console.log(`[${serviceName}] Playing audio with ${command}`);
      this.currentAudioProcess = spawn(command, args);
      
      this.currentAudioProcess.on('close', async (code) => {
        console.log(`[${serviceName}] Audio playback finished with code ${code}`);
        this.currentAudioProcess = null;
        
        // Clean up temp file
        if (this.currentTempFile) {
          try {
            await unlink(this.currentTempFile);
            console.log(`[${serviceName}] Cleaned up temp file: ${this.currentTempFile}`);
          } catch (err) {
            console.error(`[${serviceName}] Failed to delete temp file: ${err}`);
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
        console.error(`[${serviceName}] Audio playback error: ${err}`);
        this.currentAudioProcess = null;
        reject(err);
      });
    });
  }
  
  stop(): void {
    if (this.currentAudioProcess) {
      console.log('[TTS] Stopping audio playback');
      this.currentAudioProcess.kill();
      this.currentAudioProcess = null;
    }
    
    // Clean up temp file if it exists
    if (this.currentTempFile) {
      unlink(this.currentTempFile).catch(err => {
        console.error(`[TTS] Failed to delete temp file during stop: ${err}`);
      });
      this.currentTempFile = null;
    }
  }
}