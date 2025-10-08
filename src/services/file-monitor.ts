import { EventEmitter } from 'events'
import { watch, FSWatcher } from 'chokidar'
import { readFileSync, statSync, existsSync } from 'fs'
import { ProfileConfig, ParsedMessage, FileState } from '../types/config.js'
import { DatabaseManager } from './database.js'
import { ParserFactory } from '../parsers/parser-factory.js'

export interface FileChange {
  filepath: string
  profile: ProfileConfig
  content: string
  offset: number
}

export class FileMonitor extends EventEmitter {
  private watchers: Map<string, FSWatcher> = new Map()
  private profiles: Map<string, ProfileConfig> = new Map()
  private database: DatabaseManager
  private changeQueue: FileChange[] = []
  private isProcessing = false
  private isInitialScanComplete = false
  private serviceStartTime = Date.now()

  constructor(database: DatabaseManager) {
    super()
    this.database = database
  }

  async startMonitoring(profiles: ProfileConfig[]): Promise<void> {
    await this.stopMonitoring()

    for (const profile of profiles) {
      if (!profile.enabled) continue

      this.profiles.set(profile.id, profile)
      console.log(`Processing profile: ${profile.id} with ${profile.watchPaths.length} watch paths`)

      // Get the parser to check its log mode
      const parser = ParserFactory.createParser(profile.parser)
      const logMode = parser.getLogMode()
      console.log(`  Parser log mode: ${logMode}`)

      // Expand tilde in all paths
      const expandedPaths = profile.watchPaths.map((path) => {
        const expanded = path.replace(/^~/, process.env.HOME || '')
        console.log(`  Watch path: ${path} -> ${expanded}`)
        return expanded
      })

      // Create a single watcher for all paths in this profile
      // For 'new' mode parsers (like OpenCode), we need to check file age
      // For 'append' mode parsers (like Claude Code), process existing files
      const watcher = watch(expandedPaths, {
        persistent: true,
        ignoreInitial: false, // Don't ignore initial files - we'll check age instead
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100,
        },
      })

      // Mark when initial scan is complete
      watcher.on('ready', () => {
        console.log(`[FileMonitor] Initial scan complete for profile: ${profile.id}`)
        this.isInitialScanComplete = true
      })

      watcher.on('add', async (path) => {
        console.log(`[FileMonitor] File added: ${path}`)

        // For 'new' mode parsers, only process files created after service started
        // For 'append' mode parsers, handle as before

        if (logMode === 'new') {
          const stats = statSync(path)
          const fileCreatedAt = stats.birthtimeMs
          const isNewFile = fileCreatedAt > this.serviceStartTime

          console.log(
            `[FileMonitor] File created: ${new Date(fileCreatedAt).toISOString()}, service started: ${new Date(this.serviceStartTime).toISOString()}, isNew: ${isNewFile}`,
          )

          // Only process files created after the service started
          if (isNewFile) {
            console.log(`[FileMonitor] Processing new file (${logMode} mode), entire content`)

            if (stats.size > 0) {
              // Read and process the entire file
              const content = readFileSync(path, 'utf-8')

              if (content.trim()) {
                const change: FileChange = {
                  filepath: path,
                  profile,
                  content,
                  offset: 0,
                }

                this.changeQueue.push(change)
                console.log(`[FileMonitor] Queued new file with ${content.length} chars`)
                this.processQueue()
              }
            }
          } else {
            console.log(`[FileMonitor] Skipping file created before service started`)
          }

          // Don't save file state for 'new' mode - each file is independent
          console.log(`[FileMonitor] Skipping file state for ${logMode} mode`)
        } else {
          // For 'append' mode (Claude Code), handle as before
          // Check if this file has been seen before
          const existingState = await this.database.getFileState(path)
          const stats = statSync(path)

          if (existingState) {
            // File exists in database - check for new content only
            console.log(`[FileMonitor] File already tracked, checking for new content`)

            if (stats.size > existingState.lastProcessedOffset) {
              // Has new content since last processed
              console.log(`[FileMonitor] Found new content (${stats.size - existingState.lastProcessedOffset} bytes)`)
              await this.handleFileChange(path, profile)
            } else {
              console.log(`[FileMonitor] No new content to process`)
            }
          } else if (!this.isInitialScanComplete) {
            // New file during startup scan - just save state, don't process old content
            console.log(`[FileMonitor] New file detected during startup scan, saving state without processing`)

            // Save file state with current size (marking all existing content as "processed")
            const state: FileState = {
              filepath: path,
              lastModified: stats.mtimeMs,
              fileSize: stats.size,
              lastProcessedOffset: stats.size, // Mark current size as processed
            }
            await this.database.updateFileState(state)
            console.log(`[FileMonitor] Saved file state at offset ${stats.size} (skipping existing content)`)
          } else {
            // New file after startup - process entire content
            console.log(`[FileMonitor] New file detected after startup, processing entire content`)

            if (stats.size > 0) {
              // Read and process the entire file
              const content = readFileSync(path, 'utf-8')

              if (content.trim()) {
                const change: FileChange = {
                  filepath: path,
                  profile,
                  content,
                  offset: 0,
                }

                this.changeQueue.push(change)
                console.log(`[FileMonitor] Queued new file with ${content.length} chars`)
                this.processQueue()
              }
            }

            // Save file state with current size
            const state: FileState = {
              filepath: path,
              lastModified: stats.mtimeMs,
              fileSize: stats.size,
              lastProcessedOffset: stats.size,
            }
            await this.database.updateFileState(state)
            console.log(`[FileMonitor] Saved file state at offset ${stats.size}`)
          }
        }
      })

      watcher.on('change', (path) => {
        // Only handle changes for 'append' mode parsers
        // 'new' mode parsers create new files, they don't modify existing ones
        if (logMode === 'append') {
          console.log(`[FileMonitor] Change detected in: ${path}`)
          this.handleFileChange(path, profile)
        } else {
          console.log(`[FileMonitor] Ignoring change for ${logMode} mode file: ${path}`)
        }
      })

      watcher.on('error', (error) => {
        console.error(`[FileMonitor] Watcher error for profile ${profile.id}:`, error)
      })

      this.watchers.set(profile.id, watcher)
    }

    console.log(`Monitoring ${profiles.filter((p) => p.enabled).length} profiles with watchers`)
  }

  async stopMonitoring(): Promise<void> {
    for (const [key, watcher] of this.watchers) {
      await watcher.close()
    }
    this.watchers.clear()
    this.profiles.clear()
  }

  stopMonitoringProfile(profileId: string): void {
    const watcher = this.watchers.get(profileId)
    if (watcher) {
      watcher.close()
      this.watchers.delete(profileId)
    }
    this.profiles.delete(profileId)
  }

  // Removed handleNewFile - no longer needed as we handle all files uniformly

  // Removed initializeFileState - no longer needed as we handle state inline

  private async handleFileChange(filepath: string, profile: ProfileConfig): Promise<void> {
    console.log(`[FileMonitor] Processing change for: ${filepath} (profile: ${profile.id})`)

    if (!existsSync(filepath)) {
      console.log(`[FileMonitor] File no longer exists: ${filepath}`)
      return
    }

    const stats = statSync(filepath)
    console.log(`[FileMonitor] File stats - size: ${stats.size}, mtime: ${new Date(stats.mtimeMs).toISOString()}`)

    let fileState = await this.database.getFileState(filepath)

    if (!fileState) {
      console.log(`[FileMonitor] No previous state found, treating as new file`)
      // This shouldn't happen in normal flow as 'add' event handles new files
      // But if it does, treat the entire file as new content
      const newState: FileState = {
        filepath,
        lastModified: stats.mtimeMs,
        fileSize: stats.size,
        lastProcessedOffset: 0,
      }
      await this.database.updateFileState(newState)
      fileState = newState
    }

    console.log(`[FileMonitor] Previous state - size: ${fileState.fileSize}, offset: ${fileState.lastProcessedOffset}`)

    if (stats.size <= fileState.lastProcessedOffset) {
      if (stats.size < fileState.lastProcessedOffset) {
        console.log(`[FileMonitor] File truncated, resetting offset from ${fileState.lastProcessedOffset} to 0`)
        const newState: FileState = {
          filepath,
          lastModified: stats.mtimeMs,
          fileSize: stats.size,
          lastProcessedOffset: 0,
        }
        await this.database.updateFileState(newState)
        await this.handleFileChange(filepath, profile)
      } else {
        console.log(`[FileMonitor] No new content (size: ${stats.size} <= offset: ${fileState.lastProcessedOffset})`)
      }
      return
    }

    const bytesToRead = stats.size - fileState.lastProcessedOffset
    console.log(`[FileMonitor] Reading ${bytesToRead} new bytes from offset ${fileState.lastProcessedOffset}`)

    const newContent = this.readFileFromOffset(filepath, fileState.lastProcessedOffset)

    if (newContent.trim()) {
      console.log(`[FileMonitor] Found new content (${newContent.length} chars), adding to queue`)
      const change: FileChange = {
        filepath,
        profile,
        content: newContent,
        offset: fileState.lastProcessedOffset,
      }

      this.changeQueue.push(change)
      console.log(`[FileMonitor] Queue size: ${this.changeQueue.length}`)
      this.processQueue()
    } else {
      console.log(`[FileMonitor] New content is empty/whitespace only`)
    }

    const newState: FileState = {
      filepath,
      lastModified: stats.mtimeMs,
      fileSize: stats.size,
      lastProcessedOffset: stats.size,
    }
    await this.database.updateFileState(newState)
  }

  private readFileFromOffset(filepath: string, offset: number): string {
    try {
      const buffer = readFileSync(filepath)
      return buffer.toString('utf-8', offset)
    } catch (error) {
      console.error(`Error reading file ${filepath}:`, error)
      return ''
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.changeQueue.length === 0) {
      if (this.isProcessing) {
        console.log(`[FileMonitor] Already processing queue`)
      }
      return
    }

    this.isProcessing = true
    console.log(`[FileMonitor] Processing queue with ${this.changeQueue.length} items`)

    while (this.changeQueue.length > 0) {
      const change = this.changeQueue.shift()
      if (!change) continue

      try {
        console.log(`[FileMonitor] Emitting fileChanged event for ${change.filepath}`)
        this.emit('fileChanged', change)
      } catch (error) {
        console.error(`[FileMonitor] Error processing file change for ${change.filepath}:`, error)
      }
    }

    this.isProcessing = false
    console.log(`[FileMonitor] Queue processing complete`)
  }

  updateProfiles(profiles: ProfileConfig[]): void {
    const enabledProfiles = profiles.filter((p) => p.enabled)
    const currentIds = new Set(Array.from(this.profiles.keys()))
    const newIds = new Set(enabledProfiles.map((p) => p.id))

    const toRemove = Array.from(currentIds).filter((id) => !newIds.has(id))
    const toAdd = enabledProfiles.filter((p) => !currentIds.has(p.id))
    const toUpdate = enabledProfiles.filter((p) => currentIds.has(p.id))

    for (const profileId of toRemove) {
      const watcher = this.watchers.get(profileId)
      if (watcher) {
        watcher.close()
        this.watchers.delete(profileId)
      }
      this.profiles.delete(profileId)
    }

    for (const profile of [...toAdd, ...toUpdate]) {
      this.profiles.set(profile.id, profile)
    }

    if (toAdd.length > 0) {
      this.startMonitoring(toAdd)
    }
  }
}
