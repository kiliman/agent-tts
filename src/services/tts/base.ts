import { TTSQueueEntry } from '../../types/config';

export abstract class BaseTTSService {
  protected apiKey: string;
  
  constructor(protected config: any) {
    this.apiKey = config.apiKey || '';
  }
  
  abstract tts(text: string): Promise<void>;
  abstract isAvailable(): boolean;
}