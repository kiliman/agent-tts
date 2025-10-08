import { EventEmitter } from 'events'
import chokidar from 'chokidar'
import fs from 'fs'
import path from 'path'
import { AppConfig, ProfileConfig } from '../shared/types.js'
import { FileStateRepository } from '../database/file-states.js'
import { SettingsRepository } from '../database/settings.js'
import { ChangeProcessor } from './change-processor'

export interface FileChange {
  filePath: string
  profile: ProfileConfig
  content: string
  timestamp: number
}

export class FileMonitor extends EventEmitter {
  private watchers: Map<string, chokidar.FSWatcher> = new Map()
  private fileStates: FileStateRepository
  private settings: SettingsRepository
  private changeProcessor: ChangeProcessor
  private config: AppConfig
  private isRunning = false

  constructor(config: AppConfig) {
    super()
    this.config = config
    this.fileStates = new FileStateRepository()
    this.settings = new SettingsRepository()
    this.changeProcessor = new ChangeProcessor(config)
  }

  async start(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true

    // Start watchers for each enabled profile
    for (const profile of this.config.profiles) {
      if (await this.isProfileEnabled(profile)) {
        await this.startProfileWatcher(profile)
      }
    }

    // Listen for change processor events
    this.changeProcessor.on('messageReady', (data) => {
      this.emit('messageReady', data)
    })

    this.changeProcessor.on('error', (error) => {
      this.emit('error', error)
    })
  }

  private async isProfileEnabled(profile: ProfileConfig): Promise<boolean> {
    const isEnabled = await this.settings.getProfileEnabled(profile.name)
    const isMuted = await this.settings.getMuteAll()
    return isEnabled && !isMuted
  }

  private async startProfileWatcher(profile: ProfileConfig): Promise<void> {
    const watcherKey = profile.name

    // Clean up existing watcher if any
    if (this.watchers.has(watcherKey)) {
      await this.watchers.get(watcherKey)!.close()
    }

    // Create watcher for this profile
    const watcher = chokidar.watch(profile.watch, {
      persistent: true,
      ignoreInitial: true,
      ignored: profile.exclude,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    })

    // Handle file changes
    watcher.on('change', async (filePath) => {
      await this.handleFileChange(filePath, profile)
    })

    // Handle new files
    watcher.on('add', async (filePath) => {
      // Initialize file state for new files
      const stats = fs.statSync(filePath)
      this.fileStates.upsertFileState({
        filePath,
        profile: profile.name,
        lastModified: stats.mtimeMs,
        fileSize: 0, // Start from beginning for new files
      })

      // Process the entire file
      await this.handleFileChange(filePath, profile)
    })

    // Handle errors
    watcher.on('error', (error) => {
      console.error(`Watcher error for profile ${profile.name}:`, error)
      this.emit('error', { profile: profile.name, error })
    })

    this.watchers.set(watcherKey, watcher)
  }

  private async handleFileChange(filePath: string, profile: ProfileConfig): Promise<void> {
    try {
      // Check if profile is still enabled
      if (!(await this.isProfileEnabled(profile))) {
        return
      }

      // Get file state from database
      const fileState = await this.fileStates.getFileState(filePath)
      const stats = fs.statSync(filePath)

      // Read only new content
      let content = ''
      const startOffset = fileState?.fileSize || 0

      if (stats.size > startOffset) {
        const fd = fs.openSync(filePath, 'r')
        const buffer = Buffer.alloc(stats.size - startOffset)
        fs.readSync(fd, buffer, 0, buffer.length, startOffset)
        fs.closeSync(fd)
        content = buffer.toString('utf-8')
      }

      // Skip if no new content
      if (!content || content.trim().length === 0) {
        return
      }

      // Queue the change for processing
      const change: FileChange = {
        filePath,
        profile,
        content,
        timestamp: Date.now(),
      }

      await this.changeProcessor.processChange(change)

      // Update file state after successful processing
      this.fileStates.upsertFileState({
        filePath,
        profile: profile.name,
        lastModified: stats.mtimeMs,
        fileSize: stats.size,
      })
    } catch (error) {
      console.error(`Error processing file change for ${filePath}:`, error)
      this.emit('error', {
        filePath,
        profile: profile.name,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return
    this.isRunning = false

    // Stop all watchers
    for (const [key, watcher] of this.watchers) {
      await watcher.close()
    }
    this.watchers.clear()

    // Stop change processor
    await this.changeProcessor.stop()
  }

  async waitForPlaybackCompletion(): Promise<void> {
    await this.changeProcessor.waitForCompletion()
  }

  toggleProfile(profileName: string, enabled: boolean): void {
    this.settings.setProfileEnabled(profileName, enabled)

    const profile = this.config.profiles.find((p) => p.name === profileName)
    if (!profile) return

    if (enabled && this.isRunning && !this.settings.getMuteAll()) {
      // Start watcher for this profile
      this.startProfileWatcher(profile)
    } else {
      // Stop watcher for this profile
      const watcher = this.watchers.get(profileName)
      if (watcher) {
        watcher.close()
        this.watchers.delete(profileName)
      }
    }
  }

  toggleMute(muted: boolean): void {
    this.settings.setMuteAll(muted)

    if (muted) {
      // Stop all processing but keep watchers running
      this.changeProcessor.pause()
    } else {
      // Resume processing
      this.changeProcessor.resume()
    }
  }

  getEnabledProfiles(): string[] {
    return this.config.profiles.filter((p) => this.isProfileEnabled(p)).map((p) => p.name)
  }
}
