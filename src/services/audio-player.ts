import { ChildProcess, spawn } from 'child_process';
import { unlink } from 'fs/promises';

export class AudioPlayer {
  private currentAudioProcess: ChildProcess | null = null;
  private currentTempFile: string | null = null;
  
  /**
   * Play an audio file using the system's audio player
   */
  async play(filePath: string, options?: { tempFile?: boolean }): Promise<void> {
    // Stop any currently playing audio
    this.stop();
    
    // Store temp file reference if this is a temporary file
    if (options?.tempFile) {
      this.currentTempFile = filePath;
    }
    
    return new Promise((resolve, reject) => {
      const platform = process.platform;
      let command: string;
      let args: string[];
      
      if (platform === 'darwin') {
        command = 'afplay';
        args = [filePath];
      } else if (platform === 'linux') {
        command = 'ffplay';
        args = ['-nodisp', '-autoexit', filePath];
      } else if (platform === 'win32') {
        command = 'powershell';
        args = ['-c', `(New-Object Media.SoundPlayer '${filePath}').PlaySync()`];
      } else {
        reject(new Error(`Unsupported platform: ${platform}`));
        return;
      }
      
      console.log(`[AudioPlayer] Playing audio: ${filePath} with ${command}`);
      this.currentAudioProcess = spawn(command, args);
      
      this.currentAudioProcess.on('close', async (code) => {
        console.log(`[AudioPlayer] Audio playback finished with code ${code}`);
        this.currentAudioProcess = null;
        
        // Clean up temp file if specified
        if (this.currentTempFile) {
          try {
            await unlink(this.currentTempFile);
            console.log(`[AudioPlayer] Cleaned up temp file: ${this.currentTempFile}`);
          } catch (err) {
            console.error(`[AudioPlayer] Failed to delete temp file: ${err}`);
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
        console.error(`[AudioPlayer] Audio playback error: ${err}`);
        this.currentAudioProcess = null;
        this.currentTempFile = null;
        reject(err);
      });
    });
  }
  
  /**
   * Stop the currently playing audio
   */
  stop(): void {
    if (this.currentAudioProcess) {
      console.log('[AudioPlayer] Stopping audio playback');
      this.currentAudioProcess.kill();
      this.currentAudioProcess = null;
    }
    
    // Clean up temp file if it exists
    if (this.currentTempFile) {
      unlink(this.currentTempFile).catch(err => {
        console.error(`[AudioPlayer] Failed to delete temp file during stop: ${err}`);
      });
      this.currentTempFile = null;
    }
  }
  
  /**
   * Check if audio is currently playing
   */
  isPlaying(): boolean {
    return this.currentAudioProcess !== null;
  }
}