import { EventEmitter } from "events";
import { AgentTTSConfig, ProfileConfig } from "../types/config.js";
import { DatabaseManager } from "./database.js";
import { FileMonitor } from "./file-monitor.js";
import { MessageProcessor } from "./message-processor.js";
import { TTSQueueProcessor, QueuedMessage } from "./tts-queue.js";
import { SettingsRepository } from "../database/settings.js";

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
    this.fileMonitor.on("fileChanged", async (change) => {
      console.log(
        `[AppCoordinator] Received fileChanged event for: ${change.filepath}`
      );
      console.log(
        `[AppCoordinator] Profile: ${change.profile.id}, Content length: ${change.content.length}`
      );
      await this.messageProcessor.processFileChange(change);
    });

    // Handle processed messages ready for TTS
    this.messageProcessor.on(
      "messageQueued",
      async (message: QueuedMessage) => {
        console.log(
          `[AppCoordinator] Message queued for TTS from profile: ${message.profile}`
        );
        console.log(
          `[AppCoordinator] Text: ${message.filteredText.substring(0, 100)}${
            message.filteredText.length > 100 ? "..." : ""
          }`
        );

        // Emit log-added event for WebSocket clients
        const logEntry = {
          id: message.id,
          timestamp: message.timestamp,
          profile: message.profile,
          filePath: message.filename,
          originalText: message.originalText,
          filteredText: message.filteredText,
          status: "queued",
          avatarUrl: message.profileConfig?.ttsService?.avatarUrl,
          profileUrl: message.profileConfig?.ttsService?.profileUrl,
          voiceName: message.profileConfig?.ttsService?.voiceName,
        };
        this.emit("log-added", logEntry);

        // Check if profile is enabled and not muted
        const isEnabled = this.isProfileEnabled(message.profile);
        console.log(
          `[AppCoordinator] Profile ${message.profile} enabled: ${isEnabled}`
        );

        if (isEnabled) {
          this.ttsQueue.addToQueue(message);
        } else {
          console.log(`[AppCoordinator] Skipping message - profile disabled`);
        }
      }
    );

    // Handle TTS events
    this.ttsQueue.on("playing", (message) => {
      console.log(
        `[AppCoordinator] TTS playing: ${message.filteredText.substring(
          0,
          50
        )}...`
      );
      this.emit("ttsPlaying", message);
      this.emit("status-changed", {
        playing: true,
        playingId: message.id,
        currentMessage: message,
      });
    });

    this.ttsQueue.on("played", (message) => {
      console.log(`[AppCoordinator] TTS played successfully`);
      this.emit("ttsPlayed", message);
      this.emit("status-changed", {
        playing: false,
        playedId: message.id,
      });
    });

    this.ttsQueue.on("error", ({ message, error }) => {
      console.error(`[AppCoordinator] TTS error:`, error);
      this.emit("ttsError", { message, error });
    });

    // Handle errors
    this.fileMonitor.on("error", (error) => {
      console.error(`[AppCoordinator] FileMonitor error:`, error);
      this.emit("error", { source: "fileMonitor", error });
    });

    this.messageProcessor.on("processingError", (error) => {
      console.error(`[AppCoordinator] MessageProcessor error:`, error);
      this.emit("error", { source: "messageProcessor", error });
    });
  }

  async initialize(config: AgentTTSConfig): Promise<void> {
    this.config = config;

    // Apply global mute setting
    this.ttsQueue.setMuted(config.muted || false);

    // Start monitoring files for enabled profiles
    const enabledProfiles: ProfileConfig[] = [];
    for (const profile of config.profiles) {
      if (profile.enabled !== false && this.isProfileEnabled(profile.id)) {
        enabledProfiles.push(profile);
      }
    }

    await this.fileMonitor.startMonitoring(enabledProfiles);
  }

  async updateConfig(config: AgentTTSConfig): Promise<void> {
    console.log("[AppCoordinator] Updating configuration...");

    // Stop current monitoring
    await this.fileMonitor.stopMonitoring();

    // Wait for current TTS to finish
    await this.waitForTTSCompletion();

    // Clear cached TTS services to use new config
    this.ttsQueue.clearCachedServices();

    // Reinitialize with new config
    await this.initialize(config);

    console.log("[AppCoordinator] Configuration updated successfully");
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
    this.settings.setProfileEnabled(profileId, enabled);

    if (this.config) {
      const profile = this.config.profiles.find((p) => p.id === profileId);
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
    this.settings.setMuteAll(muted);
    this.ttsQueue.setMuted(muted);
  }

  stopTTS(): void {
    this.ttsQueue.stopCurrent();
  }

  // New API methods for web service
  async pausePlayback(): Promise<void> {
    this.ttsQueue.pauseCurrent();
  }

  async resumePlayback(): Promise<void> {
    this.ttsQueue.resumeCurrent();
  }

  async stopPlayback(): Promise<void> {
    this.ttsQueue.stopCurrent();
    this.ttsQueue.clearQueue();
  }

  async skipCurrent(): Promise<void> {
    this.ttsQueue.skipCurrent();
  }

  async getProfiles(): Promise<any[]> {
    if (!this.config) return [];

    const profiles = this.config.profiles.map((profile) => ({
      id: profile.id,
      name: profile.name || profile.id,
      enabled: this.isProfileEnabled(profile.id),
      icon: profile.icon,
      avatarUrl: profile.ttsService?.avatarUrl,
      profileUrl: profile.ttsService?.profileUrl,
      voiceName: profile.ttsService?.voiceName,
    }));

    return profiles;
  }

  async setProfileEnabled(profileId: string, enabled: boolean): Promise<void> {
    await this.toggleProfile(profileId, enabled);
  }

  async getLogsWithAvatars(
    limit: number = 50,
    profileFilter?: string
  ): Promise<any[]> {
    const logs = profileFilter
      ? this.database.getTTSLog().getLogsByProfile(profileFilter, limit)
      : this.database.getTTSLog().getRecentLogs(limit);

    // Enrich logs with avatar info from config
    return logs.map((log) => {
      const profile = this.config?.profiles.find((p) => p.id === log.profile);
      return {
        ...log,
        avatarUrl: profile?.ttsService?.avatarUrl,
        profileUrl: profile?.ttsService?.profileUrl,
        voiceName: profile?.ttsService?.voiceName,
      };
    });
  }

  async getLatestLogsPerProfile(): Promise<any[]> {
    if (!this.config) return [];

    const latestLogs: any[] = [];

    for (const profile of this.config.profiles) {
      const logs = this.database.getTTSLog().getLogsByProfile(profile.id, 1);
      if (logs.length > 0) {
        latestLogs.push({
          ...logs[0],
          profileName: profile.name || profile.id,
          profileIcon: profile.icon,
          avatarUrl: profile.ttsService?.avatarUrl,
          profileUrl: profile.ttsService?.profileUrl,
          voiceName: profile.ttsService?.voiceName,
        });
      }
    }

    return latestLogs;
  }

  async replayLog(logId: number): Promise<void> {
    const log = this.database.getTTSLog().getLogById(logId);
    if (log) {
      this.ttsQueue.addToQueue({
        profile: log.profile,
        originalText: log.originalText,
        filteredText: log.filteredText,
        filename: log.filePath,
        timestamp: new Date(),
      });
    }
  }

  async getStatus(): Promise<any> {
    const isMuted = this.settings.getMuteAll();
    const profiles = await this.getProfiles();
    const queueSize = this.ttsQueue.getQueueSize();
    const isPlaying = this.ttsQueue.isCurrentlyPlaying();

    return {
      muted: isMuted,
      profiles,
      queue: {
        size: queueSize,
        isPlaying,
      },
    };
  }

  async isMuted(): Promise<boolean> {
    return this.settings.getMuteAll();
  }

  async setMuted(muted: boolean): Promise<void> {
    await this.toggleMute(muted);
  }

  async reloadConfig(): Promise<void> {
    // This will be called by the server when config changes are detected
    // The server's configLoader will handle the actual reload
    this.emit("config-reload-requested");
  }

  private isProfileEnabled(profileId: string): boolean {
    return this.settings.getProfileEnabled(profileId);
  }

  async shutdown(): Promise<void> {
    await this.fileMonitor.stopMonitoring();
    this.ttsQueue.clearQueue();
  }
}
