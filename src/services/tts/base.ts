import { spawn, ChildProcess } from 'child_process';
import { unlink } from 'fs/promises';

export abstract class BaseTTSService {
  protected apiKey: string;
  protected currentAudioProcess: ChildProcess | null = null;
  protected currentTempFile: string | null = null;
  
  constructor(protected config: any) {
    this.apiKey = config.apiKey || '';
  }
  
  abstract tts(text: string): Promise<void>;
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