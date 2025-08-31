import { EventEmitter } from 'events';
import { TTSQueueEntry, ProfileConfig } from '../types/config.js';
import { DatabaseManager } from './database.js';
import { TTSServiceFactory } from './tts/factory.js';
import { BaseTTSService } from './tts/base.js';

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
        // First, ensure no other entries are stuck in 'playing' state
        await this.database.resetStuckPlayingEntries();
        
        // Now mark this entry as playing
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
    // Stop the audio if playing
    if (this.currentlyPlaying) {
      try {
        const ttsService = this.getTTSService(this.currentlyPlaying.profileConfig);
        ttsService.stop();
      } catch (err) {
        console.error('[TTSQueue] Error stopping audio:', err);
      }
    }
    
    this.queue = [];
    this.currentlyPlaying = null;
    this.emit('stopped');
  }
  
  pauseCurrent(): void {
    console.log('[TTSQueue] pauseCurrent called');
    if (this.currentlyPlaying) {
      console.log('[TTSQueue] Stopping currently playing audio');
      
      // Get the TTS service and stop it
      try {
        const ttsService = this.getTTSService(this.currentlyPlaying.profileConfig);
        ttsService.stop();
        console.log('[TTSQueue] Audio stopped successfully');
      } catch (err) {
        console.error('[TTSQueue] Error stopping audio:', err);
      }
      
      // Clear the current playing state and queue
      this.currentlyPlaying = null;
      this.queue = [];
    } else {
      console.log('[TTSQueue] No audio currently playing to pause');
    }
    this.emit('paused');
  }
  
  resumeCurrent(): void {
    // For now, restart queue processing
    this.processQueue();
    this.emit('resumed');
  }
  
  skipCurrent(): void {
    this.currentlyPlaying = null;
    this.isProcessing = false;
    this.processQueue();
    this.emit('skipped');
  }
  
  clearCachedServices(): void {
    // Clear all cached TTS service instances to force recreation with new config
    this.ttsServices.clear();
    console.log('[TTSQueue] Cleared all cached TTS services');
  }
  
  getQueueLength(): number {
    return this.queue.length;
  }
  
  getQueueSize(): number {
    return this.queue.length;
  }
  
  isQueueProcessing(): boolean {
    return this.isProcessing;
  }
  
  isCurrentlyPlaying(): boolean {
    return this.currentlyPlaying !== null;
  }
}