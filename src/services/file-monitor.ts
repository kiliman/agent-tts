import { EventEmitter } from 'events';
import { watch, FSWatcher } from 'chokidar';
import { readFileSync, statSync, existsSync } from 'fs';
import { glob } from 'glob';
import { ProfileConfig, ParsedMessage, FileState } from '../types/config';
import { DatabaseManager } from './database';

export interface FileChange {
  filepath: string;
  profile: ProfileConfig;
  content: string;
  offset: number;
}

export class FileMonitor extends EventEmitter {
  private watchers: Map<string, FSWatcher> = new Map();
  private profiles: Map<string, ProfileConfig> = new Map();
  private database: DatabaseManager;
  private changeQueue: FileChange[] = [];
  private isProcessing = false;

  constructor(database: DatabaseManager) {
    super();
    this.database = database;
  }

  async startMonitoring(profiles: ProfileConfig[]): Promise<void> {
    await this.stopMonitoring();

    for (const profile of profiles) {
      if (!profile.enabled) continue;
      
      this.profiles.set(profile.id, profile);

      for (const watchPath of profile.watchPaths) {
        const files = await this.resolveWatchPath(watchPath);
        
        for (const file of files) {
          await this.initializeFileState(file);
          
          const watcher = watch(file, {
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
              stabilityThreshold: 500,
              pollInterval: 100
            }
          });

          watcher.on('change', () => this.handleFileChange(file, profile));
          watcher.on('add', () => this.handleFileChange(file, profile));
          
          this.watchers.set(`${profile.id}:${file}`, watcher);
        }
      }
    }

    console.log(`Monitoring ${this.watchers.size} files across ${profiles.filter(p => p.enabled).length} profiles`);
  }

  async stopMonitoring(): Promise<void> {
    for (const [key, watcher] of this.watchers) {
      await watcher.close();
    }
    this.watchers.clear();
    this.profiles.clear();
  }

  stopMonitoringProfile(profileId: string): void {
    const keysToRemove: string[] = [];
    
    for (const [key, watcher] of this.watchers) {
      if (key.startsWith(`${profileId}:`)) {
        watcher.close();
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => this.watchers.delete(key));
    this.profiles.delete(profileId);
  }

  private async resolveWatchPath(watchPath: string): Promise<string[]> {
    if (watchPath.includes('*')) {
      const expandedPath = watchPath.replace(/^~/, process.env.HOME || '');
      return await glob(expandedPath);
    }
    
    const expandedPath = watchPath.replace(/^~/, process.env.HOME || '');
    if (existsSync(expandedPath)) {
      return [expandedPath];
    }
    
    return [];
  }

  private async initializeFileState(filepath: string): Promise<void> {
    if (!existsSync(filepath)) return;

    const stats = statSync(filepath);
    const existingState = await this.database.getFileState(filepath);

    if (!existingState) {
      const state: FileState = {
        filepath,
        lastModified: stats.mtimeMs,
        fileSize: stats.size,
        lastProcessedOffset: stats.size
      };
      await this.database.updateFileState(state);
    }
  }

  private async handleFileChange(filepath: string, profile: ProfileConfig): Promise<void> {
    if (!existsSync(filepath)) return;

    const stats = statSync(filepath);
    const fileState = await this.database.getFileState(filepath);
    
    if (!fileState) {
      await this.initializeFileState(filepath);
      return;
    }

    if (stats.size <= fileState.lastProcessedOffset) {
      if (stats.size < fileState.lastProcessedOffset) {
        const newState: FileState = {
          filepath,
          lastModified: stats.mtimeMs,
          fileSize: stats.size,
          lastProcessedOffset: 0
        };
        await this.database.updateFileState(newState);
        await this.handleFileChange(filepath, profile);
      }
      return;
    }

    const newContent = this.readFileFromOffset(filepath, fileState.lastProcessedOffset);
    
    if (newContent.trim()) {
      const change: FileChange = {
        filepath,
        profile,
        content: newContent,
        offset: fileState.lastProcessedOffset
      };

      this.changeQueue.push(change);
      this.processQueue();
    }

    const newState: FileState = {
      filepath,
      lastModified: stats.mtimeMs,
      fileSize: stats.size,
      lastProcessedOffset: stats.size
    };
    await this.database.updateFileState(newState);
  }

  private readFileFromOffset(filepath: string, offset: number): string {
    try {
      const buffer = readFileSync(filepath);
      return buffer.toString('utf-8', offset);
    } catch (error) {
      console.error(`Error reading file ${filepath}:`, error);
      return '';
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.changeQueue.length === 0) return;

    this.isProcessing = true;

    while (this.changeQueue.length > 0) {
      const change = this.changeQueue.shift();
      if (!change) continue;

      try {
        this.emit('fileChanged', change);
      } catch (error) {
        console.error(`Error processing file change for ${change.filepath}:`, error);
      }
    }

    this.isProcessing = false;
  }

  updateProfiles(profiles: ProfileConfig[]): void {
    const enabledProfiles = profiles.filter(p => p.enabled);
    const currentIds = new Set(Array.from(this.profiles.keys()));
    const newIds = new Set(enabledProfiles.map(p => p.id));

    const toRemove = Array.from(currentIds).filter(id => !newIds.has(id));
    const toAdd = enabledProfiles.filter(p => !currentIds.has(p.id));
    const toUpdate = enabledProfiles.filter(p => currentIds.has(p.id));

    for (const profileId of toRemove) {
      for (const [key, watcher] of this.watchers) {
        if (key.startsWith(`${profileId}:`)) {
          watcher.close();
          this.watchers.delete(key);
        }
      }
      this.profiles.delete(profileId);
    }

    for (const profile of [...toAdd, ...toUpdate]) {
      this.profiles.set(profile.id, profile);
    }

    if (toAdd.length > 0) {
      this.startMonitoring(toAdd);
    }
  }
}