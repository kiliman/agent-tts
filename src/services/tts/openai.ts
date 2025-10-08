import { BaseTTSService } from './base.js'
import { TTSServiceConfig } from '../../types/config.js'
import axios from 'axios'

export class OpenAITTSService extends BaseTTSService {
  protected baseUrl: string
  protected voiceId: string
  protected model: string
  protected speed: number
  protected responseFormat: string
  protected instructions?: string

  constructor(config: TTSServiceConfig) {
    super(config)

    // Support custom base URLs for OpenAI-compatible services (like Kokoro)
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1'
    this.voiceId = config.voiceId || 'alloy'
    this.model = config.model || 'tts-1'
    this.speed = config.options?.speed || 1.0
    this.responseFormat = config.options?.responseFormat || 'mp3'
    this.instructions = config.options?.instructions

    console.log(`[OpenAI] Initializing with base URL: ${this.baseUrl}, voice: ${this.voiceId}, model: ${this.model}`)
  }

  async tts(text: string, metadata?: { profile?: string; timestamp?: Date }): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI-compatible service requires an API key')
    }

    console.log(`[OpenAI] Converting text to speech - Voice: ${this.voiceId}, Length: ${text.length} chars`)
    if (text.length > 100) {
      console.log(`[OpenAI] Text preview: ${text.substring(0, 100)}...`)
    } else {
      console.log(`[OpenAI] Full text: ${text}`)
    }

    try {
      const requestBody: any = {
        model: this.model,
        input: text,
        voice: this.voiceId,
        speed: this.speed,
        response_format: this.responseFormat,
      }

      // Add instructions if provided
      if (this.instructions) {
        requestBody.instructions = this.instructions
      }

      const response = await axios.post(`${this.baseUrl}/audio/speech`, requestBody, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      })

      // Determine file extension
      const extension =
        this.responseFormat === 'opus'
          ? 'opus'
          : this.responseFormat === 'aac'
            ? 'aac'
            : this.responseFormat === 'flac'
              ? 'flac'
              : this.responseFormat === 'wav'
                ? 'wav'
                : this.responseFormat === 'pcm'
                  ? 'pcm'
                  : 'mp3'

      // Save directly to permanent location
      if (metadata?.profile && metadata?.timestamp) {
        const audioPath = await this.saveAudioData(
          Buffer.from(response.data),
          metadata.profile,
          metadata.timestamp,
          extension,
        )
        return audioPath
      } else {
        // If no metadata, we need to create a temp path (shouldn't happen in normal flow)
        throw new Error('Metadata required for audio file storage')
      }
    } catch (error: any) {
      // Extract useful error information without dumping entire request object
      let errorMessage = 'TTS request failed'
      let errorDetails: any = {}

      if (error.response) {
        errorDetails.status = error.response.status

        // Try to parse error response body
        if (error.response.data) {
          try {
            // If data is a buffer, convert to string
            const responseData = Buffer.isBuffer(error.response.data)
              ? JSON.parse(error.response.data.toString())
              : error.response.data

            if (responseData.detail) {
              errorDetails.detail = responseData.detail
              if (responseData.detail.message) {
                errorMessage = responseData.detail.message
              }
            } else if (responseData.error) {
              errorDetails.error = responseData.error
              errorMessage =
                typeof responseData.error === 'string' ? responseData.error : responseData.error.message || errorMessage
            }
          } catch {
            // If we can't parse the response, just use the status code
            errorDetails.rawResponse = error.response.data?.toString?.().substring(0, 200)
          }
        }

        // Add helpful context based on status code
        if (error.response.status === 429) {
          errorMessage = 'Rate limited - too many requests'
        } else if (error.response.status === 401) {
          errorMessage = 'Unauthorized - check API key'
        } else if (error.response.status === 400) {
          errorMessage = errorMessage || 'Bad request - check parameters'
        }
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = `Cannot connect to TTS service at ${this.baseUrl}`
      } else if (error.message) {
        errorMessage = error.message
      }

      console.error(`[OpenAI] TTS Error: ${errorMessage}`)
      if (Object.keys(errorDetails).length > 0) {
        console.error('[OpenAI] Error details:', errorDetails)
      }

      // Throw a clean error message instead of the entire axios error
      const cleanError = new Error(errorMessage)
      ;(cleanError as any).details = errorDetails
      throw cleanError
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey
  }
}
