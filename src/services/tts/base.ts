import { mkdir, copyFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

export abstract class BaseTTSService {
  protected apiKey: string;
  
  constructor(protected config: any) {
    this.apiKey = config.apiKey || '';
  }
  
  abstract tts(text: string, metadata?: { profile?: string; timestamp?: Date }): Promise<string>;
  abstract isAvailable(): boolean;
  
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
}