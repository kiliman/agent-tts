import { EventEmitter } from 'events';
import { AgentTTSConfig, ProfileConfig } from '../types/config';
import { DatabaseManager } from './database';
import { FileMonitor } from './file-monitor';
import { MessageProcessor } from './message-processor';
import { TTSQueueProcessor, QueuedMessage } from './tts-queue';
import { SettingsRepository } from '../database/settings';

/**
 * Coordinates all the services in the application
 */
export class AppCoordinator extends EventEmitter {
  private database: DatabaseManager;
  private fileMonitor: FileMonitor;
  private messageProcessor: MessageProcessor;
  private ttsQueue: TTSQueueProcessor;
  private settings: SettingsRepository;
  private config: AgentTTSConfig | null = null;
  
  constructor() {
    super();
    this.database = new DatabaseManager();
    this.fileMonitor = new FileMonitor(this.database);
    this.messageProcessor = new MessageProcessor(this.database);
    this.ttsQueue = new TTSQueueProcessor(this.database);
    this.settings = new SettingsRepository();
    
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    // Handle file changes
    this.fileMonitor.on('fileChanged', async (change) => {
      await this.messageProcessor.processFileChange(change);
    });
    
    // Handle processed messages ready for TTS
    this.messageProcessor.on('messageQueued', async (message: QueuedMessage) => {
      // Check if profile is enabled and not muted
      if (await this.isProfileEnabled(message.profile)) {
        this.ttsQueue.addToQueue(message);
      }
    });
    
    // Handle TTS events
    this.ttsQueue.on('playing', (message) => {
      this.emit('ttsPlaying', message);
    });
    
    this.ttsQueue.on('played', (message) => {
      this.emit('ttsPlayed', message);
    });
    
    this.ttsQueue.on('error', ({ message, error }) => {
      this.emit('ttsError', { message, error });
    });
    
    // Handle errors
    this.fileMonitor.on('error', (error) => {
      this.emit('error', { source: 'fileMonitor', error });
    });
    
    this.messageProcessor.on('processingError', (error) => {
      this.emit('error', { source: 'messageProcessor', error });
    });
  }
  
  async initialize(config: AgentTTSConfig): Promise<void> {
    this.config = config;
    
    // Apply global mute setting
    this.ttsQueue.setMuted(config.muted || false);
    
    // Start monitoring files for enabled profiles
    const enabledProfiles: ProfileConfig[] = [];
    for (const profile of config.profiles) {
      if (profile.enabled !== false && await this.isProfileEnabled(profile.id)) {
        enabledProfiles.push(profile);
      }
    }
    
    await this.fileMonitor.startMonitoring(enabledProfiles);
  }
  
  async updateConfig(config: AgentTTSConfig): Promise<void> {
    // Stop current monitoring
    await this.fileMonitor.stopMonitoring();
    
    // Wait for current TTS to finish
    await this.waitForTTSCompletion();
    
    // Reinitialize with new config
    await this.initialize(config);
  }
  
  private async waitForTTSCompletion(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ttsQueue.isQueueProcessing()) {
        resolve();
        return;
      }
      
      const checkInterval = setInterval(() => {
        if (!this.ttsQueue.isQueueProcessing()) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }
  
  async toggleProfile(profileId: string, enabled: boolean): Promise<void> {
    await this.settings.setProfileEnabled(profileId, enabled);
    
    if (this.config) {
      const profile = this.config.profiles.find(p => p.id === profileId);
      if (profile) {
        if (enabled && profile.enabled !== false) {
          // Start monitoring for this profile
          await this.fileMonitor.startMonitoring([profile]);
        } else {
          // Stop monitoring for this profile
          this.fileMonitor.stopMonitoringProfile(profileId);
        }
      }
    }
  }
  
  async toggleMute(muted: boolean): Promise<void> {
    await this.settings.setMuteAll(muted);
    this.ttsQueue.setMuted(muted);
  }
  
  stopTTS(): void {
    this.ttsQueue.stopCurrent();
  }
  
  private async isProfileEnabled(profileId: string): Promise<boolean> {
    return await this.settings.getProfileEnabled(profileId);
  }
  
  async shutdown(): Promise<void> {
    await this.fileMonitor.stopMonitoring();
    this.ttsQueue.clearQueue();
  }
}