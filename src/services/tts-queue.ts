import { EventEmitter } from 'events'
import { TTSQueueEntry, ProfileConfig } from '../types/config.js'
import { DatabaseManager } from './database.js'
import { TTSServiceFactory } from './tts/factory.js'
import { BaseTTSService } from './tts/base.js'
import { AudioPlayer } from './audio-player.js'
import { join } from 'path'
import { existsSync } from 'fs'
import { AGENT_TTS_PATHS } from '../utils/xdg-paths.js'

export interface QueuedMessage extends TTSQueueEntry {
  profileConfig: ProfileConfig
}

export class TTSQueueProcessor extends EventEmitter {
  private database: DatabaseManager
  private queue: QueuedMessage[] = []
  private currentlyPlaying: QueuedMessage | null = null
  private isProcessing = false
  private isMuted = false
  private ttsServices: Map<string, BaseTTSService> = new Map()
  private audioPlayer: AudioPlayer

  constructor(database: DatabaseManager) {
    super()
    this.database = database
    this.audioPlayer = new AudioPlayer()
  }

  addToQueue(message: QueuedMessage): void {
    if (this.isMuted) {
      console.log(`TTS is muted, skipping message from ${message.profile}`)
      return
    }

    // Check if this entry is already playing
    if (this.currentlyPlaying && this.currentlyPlaying.id === message.id) {
      console.log(`[TTSQueue] Entry ${message.id} is currently playing, skipping duplicate`)
      return
    }

    // Check if this entry is already in the queue
    const isDuplicate = this.queue.some((queuedMsg) => queuedMsg.id === message.id)
    if (isDuplicate) {
      console.log(`[TTSQueue] Entry ${message.id} is already queued, skipping duplicate`)
      return
    }

    this.queue.push(message)
    this.processQueue()
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0 || this.isMuted) {
      return
    }

    this.isProcessing = true

    while (this.queue.length > 0 && !this.isMuted) {
      const message = this.queue.shift()
      if (!message) continue

      try {
        await this.playMessage(message)
      } catch (error) {
        // Log clean error message, not entire error object
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[TTSQueue] Error playing message: ${errorMessage}`)

        if (message.id) {
          await this.database.updateTTSQueueEntry(message.id, {
            state: 'error',
            apiResponseMessage: errorMessage,
          })
        }
      }
    }

    this.isProcessing = false
  }

  private getAudioFilePath(profile: string, timestamp: Date): string {
    const dateStr = timestamp.toISOString().split('T')[0] // YYYY-MM-DD
    const epochTimestamp = Math.floor(timestamp.getTime() / 1000)
    const audioDir = join(AGENT_TTS_PATHS.cache, 'audio', dateStr)
    return join(audioDir, `${profile}-${epochTimestamp}.mp3`)
  }

  private async playMessage(message: QueuedMessage): Promise<void> {
    const startTime = Date.now()

    try {
      // Set currently playing
      this.currentlyPlaying = message

      if (message.id) {
        // First, ensure no other entries are stuck in 'playing' state
        await this.database.resetStuckPlayingEntries()

        // Now mark this entry as playing
        await this.database.updateTTSQueueEntry(message.id, {
          state: 'playing',
        })
      }

      this.emit('playing', message)

      // Check if we already have the audio file saved
      const audioFilePath = this.getAudioFilePath(message.profile, message.timestamp)

      if (existsSync(audioFilePath)) {
        console.log(`[TTSQueue] Found existing audio file: ${audioFilePath}`)
        await this.audioPlayer.play(audioFilePath)
      } else {
        console.log(`[TTSQueue] No existing audio file, generating new TTS`)

        // Get the TTS service for this profile
        const ttsService = this.getTTSService(message.profileConfig)

        if (!ttsService.isAvailable()) {
          throw new Error('TTS service not available')
        }

        // Generate TTS and get the audio file path
        const tempAudioPath = await ttsService.tts(message.filteredText, {
          profile: message.profile,
          timestamp: message.timestamp,
        })

        // Play the audio using our audio player
        if (tempAudioPath) {
          await this.audioPlayer.play(tempAudioPath, { tempFile: true })
        }
      }

      const processingTime = Date.now() - startTime

      if (message.id) {
        await this.database.updateTTSQueueEntry(message.id, {
          state: 'played',
          apiResponseStatus: 200,
          processingTime,
        })
      }

      this.emit('played', message)

      // Clear currently playing
      this.currentlyPlaying = null
    } catch (error) {
      // Clear currently playing on error
      this.currentlyPlaying = null

      const processingTime = Date.now() - startTime

      if (message.id) {
        await this.database.updateTTSQueueEntry(message.id, {
          state: 'error',
          apiResponseMessage: error instanceof Error ? error.message : String(error),
          processingTime,
        })
      }

      this.emit('error', { message, error })
      throw error
    }
  }

  private getTTSService(profile: ProfileConfig): BaseTTSService {
    const serviceKey = `${profile.id}-${profile.ttsService.type}`

    if (!this.ttsServices.has(serviceKey)) {
      const service = TTSServiceFactory.create(profile.ttsService)
      this.ttsServices.set(serviceKey, service)
    }

    return this.ttsServices.get(serviceKey)!
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted
    if (muted) {
      this.stopCurrent()
    } else {
      this.processQueue()
    }
  }

  clearQueue(): void {
    this.queue = []
    this.currentlyPlaying = null
    console.log('[TTSQueue] Queue cleared')
  }

  stopCurrent(): void {
    // Stop the audio if playing
    this.audioPlayer.stop()

    this.queue = []
    this.currentlyPlaying = null
    this.emit('stopped')
  }

  pauseCurrent(): void {
    console.log('[TTSQueue] pauseCurrent called')
    if (this.audioPlayer.isPlaying()) {
      console.log('[TTSQueue] Stopping currently playing audio')
      this.audioPlayer.stop()
      console.log('[TTSQueue] Audio stopped successfully')

      // Clear the current playing state and queue
      this.currentlyPlaying = null
      this.queue = []
    } else {
      console.log('[TTSQueue] No audio currently playing to pause')
    }
    this.emit('paused')
  }

  resumeCurrent(): void {
    // For now, restart queue processing
    this.processQueue()
    this.emit('resumed')
  }

  skipCurrent(): void {
    // Stop current audio
    this.audioPlayer.stop()

    this.currentlyPlaying = null
    this.isProcessing = false
    this.processQueue()
    this.emit('skipped')
  }

  clearCachedServices(): void {
    // Clear all cached TTS service instances to force recreation with new config
    this.ttsServices.clear()
    console.log('[TTSQueue] Cleared all cached TTS services')
  }

  getQueueLength(): number {
    return this.queue.length
  }

  getQueueSize(): number {
    return this.queue.length
  }

  isQueueProcessing(): boolean {
    return this.isProcessing
  }

  isCurrentlyPlaying(): boolean {
    return this.currentlyPlaying !== null
  }
}
