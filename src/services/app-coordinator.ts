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
  public database: DatabaseManager;
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
      console.log(`[AppCoordinator] Received fileChanged event for: ${change.filepath}`);
      console.log(`[AppCoordinator] Profile: ${change.profile.id}, Content length: ${change.content.length}`);
      await this.messageProcessor.processFileChange(change);
    });
    
    // Handle processed messages ready for TTS
    this.messageProcessor.on('messageQueued', async (message: QueuedMessage) => {
      console.log(`[AppCoordinator] Message queued for TTS from profile: ${message.profile}`);
      console.log(`[AppCoordinator] Text: ${message.filteredText.substring(0, 100)}${message.filteredText.length > 100 ? '...' : ''}`);
      
      // Check if profile is enabled and not muted
      const isEnabled = await this.isProfileEnabled(message.profile);
      console.log(`[AppCoordinator] Profile ${message.profile} enabled: ${isEnabled}`);
      
      if (isEnabled) {
        this.ttsQueue.addToQueue(message);
      } else {
        console.log(`[AppCoordinator] Skipping message - profile disabled`);
      }
    });
    
    // Handle TTS events
    this.ttsQueue.on('playing', (message) => {
      console.log(`[AppCoordinator] TTS playing: ${message.filteredText.substring(0, 50)}...`);
      this.emit('ttsPlaying', message);
    });
    
    this.ttsQueue.on('played', (message) => {
      console.log(`[AppCoordinator] TTS played successfully`);
      this.emit('ttsPlayed', message);
    });
    
    this.ttsQueue.on('error', ({ message, error }) => {
      console.error(`[AppCoordinator] TTS error:`, error);
      this.emit('ttsError', { message, error });
    });
    
    // Handle errors
    this.fileMonitor.on('error', (error) => {
      console.error(`[AppCoordinator] FileMonitor error:`, error);
      this.emit('error', { source: 'fileMonitor', error });
    });
    
    this.messageProcessor.on('processingError', (error) => {
      console.error(`[AppCoordinator] MessageProcessor error:`, error);
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
    console.log('[AppCoordinator] Updating configuration...');
    
    // Stop current monitoring
    await this.fileMonitor.stopMonitoring();
    
    // Wait for current TTS to finish
    await this.waitForTTSCompletion();
    
    // Clear cached TTS services to use new config
    this.ttsQueue.clearCachedServices();
    
    // Reinitialize with new config
    await this.initialize(config);
    
    console.log('[AppCoordinator] Configuration updated successfully');
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