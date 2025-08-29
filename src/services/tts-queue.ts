import { EventEmitter } from 'events';
import { TTSQueueEntry, ProfileConfig } from '../types/config';
import { DatabaseManager } from './database';
import { TTSServiceFactory } from './tts/factory';
import { BaseTTSService } from './tts/base';

export interface QueuedMessage extends TTSQueueEntry {
  profileConfig: ProfileConfig;
}

export class TTSQueueProcessor extends EventEmitter {
  private database: DatabaseManager;
  private queue: QueuedMessage[] = [];
  private currentlyPlaying: QueuedMessage | null = null;
  private isProcessing = false;
  private isMuted = false;
  private ttsServices: Map<string, BaseTTSService> = new Map();
  
  constructor(database: DatabaseManager) {
    super();
    this.database = database;
  }
  
  addToQueue(message: QueuedMessage): void {
    if (this.isMuted) {
      console.log(`TTS is muted, skipping message from ${message.profile}`);
      return;
    }
    
    // Check if this entry is already playing
    if (this.currentlyPlaying && this.currentlyPlaying.id === message.id) {
      console.log(`[TTSQueue] Entry ${message.id} is currently playing, skipping duplicate`);
      return;
    }
    
    // Check if this entry is already in the queue
    const isDuplicate = this.queue.some(queuedMsg => queuedMsg.id === message.id);
    if (isDuplicate) {
      console.log(`[TTSQueue] Entry ${message.id} is already queued, skipping duplicate`);
      return;
    }
    
    this.queue.push(message);
    this.processQueue();
  }
  
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0 || this.isMuted) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.queue.length > 0 && !this.isMuted) {
      const message = this.queue.shift();
      if (!message) continue;
      
      try {
        await this.playMessage(message);
      } catch (error) {
        console.error('Error playing message:', error);
        if (message.id) {
          await this.database.updateTTSQueueEntry(message.id, {
            state: 'error',
            apiResponseMessage: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    
    this.isProcessing = false;
  }
  
  private async playMessage(message: QueuedMessage): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Set currently playing
      this.currentlyPlaying = message;
      
      const ttsService = this.getTTSService(message.profileConfig);
      
      if (!ttsService.isAvailable()) {
        throw new Error('TTS service not available');
      }
      
      if (message.id) {
        await this.database.updateTTSQueueEntry(message.id, {
          state: 'playing'
        });
      }
      
      this.emit('playing', message);
      
      await ttsService.tts(message.filteredText);
      
      const processingTime = Date.now() - startTime;
      
      if (message.id) {
        await this.database.updateTTSQueueEntry(message.id, {
          state: 'played',
          apiResponseStatus: 200,
          processingTime
        });
      }
      
      this.emit('played', message);
      
      // Clear currently playing
      this.currentlyPlaying = null;
      
    } catch (error) {
      // Clear currently playing on error
      this.currentlyPlaying = null;
      
      const processingTime = Date.now() - startTime;
      
      if (message.id) {
        await this.database.updateTTSQueueEntry(message.id, {
          state: 'error',
          apiResponseMessage: error instanceof Error ? error.message : String(error),
          processingTime
        });
      }
      
      this.emit('error', { message, error });
      throw error;
    }
  }
  
  private getTTSService(profile: ProfileConfig): BaseTTSService {
    const serviceKey = `${profile.id}-${profile.ttsService.type}`;
    
    if (!this.ttsServices.has(serviceKey)) {
      const service = TTSServiceFactory.create(profile.ttsService);
      this.ttsServices.set(serviceKey, service);
    }
    
    return this.ttsServices.get(serviceKey)!;
  }
  
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.stopCurrent();
    } else {
      this.processQueue();
    }
  }
  
  clearQueue(): void {
    this.queue = [];
    this.currentlyPlaying = null;
    console.log('[TTSQueue] Queue cleared');
  }
  
  stopCurrent(): void {
    this.queue = [];
    this.currentlyPlaying = null;
    this.emit('stopped');
  }
  
  clearCachedServices(): void {
    // Clear all cached TTS service instances to force recreation with new config
    this.ttsServices.clear();
    console.log('[TTSQueue] Cleared all cached TTS services');
  }
  
  getQueueLength(): number {
    return this.queue.length;
  }
  
  isQueueProcessing(): boolean {
    return this.isProcessing;
  }
}