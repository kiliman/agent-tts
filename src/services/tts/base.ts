import { TTSQueueEntry } from '../../types/config.js';

export abstract class BaseTTSService {
  protected apiKey: string;
  
  constructor(protected config: any) {
    this.apiKey = config.apiKey || '';
  }
  
  abstract tts(text: string): Promise<void>;
  abstract isAvailable(): boolean;
  
  // Optional stop method - override if the service supports stopping
  stop(): void {
    // Default implementation does nothing
    // Override in subclasses that support stopping audio
  }
}