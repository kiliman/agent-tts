import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { AGENT_TTS_PATHS } from '../../utils/xdg-paths.js'

export abstract class BaseTTSService {
  protected apiKey: string

  constructor(protected config: any) {
    this.apiKey = config.apiKey || ''
  }

  abstract tts(text: string, metadata?: { profile?: string; timestamp?: Date }): Promise<string>
  abstract isAvailable(): boolean

  protected async getAudioFilePath(profile: string, timestamp: Date, extension: string = 'mp3'): Promise<string> {
    // Create directory structure: ~/.cache/agent-tts/audio/YYYY-MM-DD/
    const audioBaseDir = join(AGENT_TTS_PATHS.cache, 'audio')
    const dateStr = timestamp.toISOString().split('T')[0] // YYYY-MM-DD
    const audioDir = join(audioBaseDir, dateStr)

    // Ensure directory exists
    await mkdir(audioDir, { recursive: true })

    // Create filename: profile-id-timestamp.mp3
    const epochTimestamp = Math.floor(timestamp.getTime() / 1000)
    const filename = `${profile}-${epochTimestamp}.${extension}`
    const destPath = join(audioDir, filename)

    return destPath
  }

  protected async saveAudioData(
    audioData: Buffer,
    profile: string,
    timestamp: Date,
    extension: string = 'mp3',
  ): Promise<string> {
    try {
      const destPath = await this.getAudioFilePath(profile, timestamp, extension)
      await writeFile(destPath, audioData)
      console.log(`[TTS] Saved audio to: ${destPath}`)
      return destPath
    } catch (err) {
      console.error('[TTS] Failed to save audio file:', err)
      throw err
    }
  }
}
