import { EventEmitter } from 'events';
import { AppConfig } from '../shared/types';
import { FileChange } from './file-watcher';
import { TTSLogRepository } from '../database/tts-log';

export class ChangeProcessor extends EventEmitter {
  private config: AppConfig;
  private queue: FileChange[] = [];
  private isProcessing = false;
  private isPaused = false;
  private ttsLog: TTSLogRepository;

  constructor(config: AppConfig) {
    super();
    this.config = config;
    this.ttsLog = new TTSLogRepository();
  }

  async processChange(change: FileChange): Promise<void> {
    // Add to queue
    this.queue.push(change);
    
    // Start processing if not already running
    if (!this.isProcessing && !this.isPaused) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isPaused) return;
    this.isProcessing = true;

    while (this.queue.length > 0 && !this.isPaused) {
      const change = this.queue.shift()!;
      
      try {
        // Parse messages using the profile's parser
        const messages = change.profile.tts.parser(change.content);
        
        // Process each message
        for (const message of messages) {
          if (this.isPaused) break;
          
          // Apply filters (to be implemented in Phase 2)
          const filteredText = this.applyFilters(message, change.profile);
          
          if (filteredText && filteredText.trim().length > 0) {
            // Log the entry
            const entryId = this.ttsLog.addEntry({
              timestamp: change.timestamp,
              filePath: change.filePath,
              profile: change.profile.name,
              originalText: message,
              filteredText: filteredText,
              status: 'queued',
              ttsStatus: 0,
              ttsMessage: '',
              elapsed: 0
            });

            // Emit message for TTS processing (to be handled in Phase 2)
            this.emit('messageReady', {
              id: entryId,
              profile: change.profile,
              text: filteredText,
              originalText: message,
              filePath: change.filePath
            });
          }
        }
      } catch (error) {
        console.error('Error processing change:', error);
        this.emit('error', {
          filePath: change.filePath,
          profile: change.profile.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.isProcessing = false;
  }

  private applyFilters(text: string, profile: any): string {
    // Basic implementation - will be enhanced in Phase 2
    let filtered = text;
    
    // Apply pronunciation rules
    for (const rule of profile.pronunciations) {
      if (typeof rule.pattern === 'string') {
        const regex = new RegExp(rule.pattern, rule.caseSensitive ? 'g' : 'gi');
        filtered = filtered.replace(regex, rule.replacement);
      } else if (rule.pattern instanceof RegExp) {
        filtered = filtered.replace(rule.pattern, rule.replacement);
      }
    }
    
    return filtered;
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
    if (!this.isProcessing && this.queue.length > 0) {
      this.processQueue();
    }
  }

  async stop(): Promise<void> {
    this.pause();
    this.queue = [];
  }

  async waitForCompletion(): Promise<void> {
    // Wait for queue to empty
    while (this.queue.length > 0 || this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}