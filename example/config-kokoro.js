/**
 * Example configuration for using Kokoro TTS
 * 
 * Kokoro is an open-source, local TTS service that provides
 * high-quality voice synthesis without cloud dependencies.
 * 
 * To use this configuration:
 * 1. Install and run Kokoro locally (default port 8080)
 * 2. Copy this file to ~/.agent-tts/index.js
 * 3. Adjust the voice and settings as needed
 */

export default {
  profiles: [
    {
      id: 'claudia-kokoro',
      name: 'Claudia (Kokoro)',
      enabled: true,
      watchPaths: [
        '~/.local/share/opencode/project/global/storage/session/message/**'
      ],
      parser: {
        type: 'opencode'
      },
      filters: [
        {
          name: 'role',
          enabled: true,
          filter: (message) => {
            // Only speak assistant messages
            return message.role === 'assistant' ? message : null;
          }
        },
        {
          name: 'emoji',
          enabled: true  // Strip emojis so TTS doesn't read emoji names
        },
        {
          name: 'length',
          enabled: true,
          filter: (message) => {
            // Skip very short messages
            if (message.content.length < 10) return null;
            
            // Truncate very long messages
            if (message.content.length > 500) {
              return {
                ...message,
                content: message.content.substring(0, 497) + '...'
              };
            }
            return message;
          }
        }
      ],
      ttsService: {
        type: 'kokoro',
        // baseUrl is optional, defaults to http://localhost:8080/v1
        baseUrl: 'http://localhost:8880/v1',
        // Voice options: af_bella, af_nicole, af_sarah (American Female)
        //                am_adam, am_michael, am_echo (American Male)
        //                bf_emma, bf_alice, bf_lily (British Female)
        //                bm_george, bm_daniel, bm_lewis (British Male)
        voiceId: 'af_bella',
        // Model name for Kokoro
        model: 'kokoro',
        // No API key needed for local instance
        apiKey: 'local',
        options: {
          // Speed of speech (0.5 to 2.0)
          speed: 1.0,
          // Output format
          responseFormat: 'mp3'
        }
      }
    },
    {
      id: 'claude-code-kokoro',
      name: 'Claude Code (Kokoro)',
      enabled: true,
      watchPaths: [
        '~/.local/share/opencode/project/global/storage/session/part/**'
      ],
      parser: {
        type: 'claude-code'
      },
      filters: [
        {
          name: 'role',
          enabled: true,
          filter: (message) => {
            return message.role === 'assistant' ? message : null;
          }
        }
      ],
      ttsService: {
        type: 'kokoro',
        voiceId: 'bf_emma', // British Female (Emma) for Claude Code
        options: {
          speed: 1.1, // Slightly faster
          responseFormat: 'mp3'
        }
      }
    }
  ]
};

/**
 * Alternative configuration for OpenAI-compatible services
 * 
 * You can also use the 'openai-compatible' type for any service
 * that implements the OpenAI TTS API, including:
 * - LocalAI
 * - Oobabooga Text Generation WebUI
 * - Any custom OpenAI-compatible endpoint
 */
export const openAICompatibleExample = {
  profiles: [
    {
      id: 'custom-tts',
      name: 'Custom OpenAI-Compatible',
      enabled: true,
      watchPaths: ['~/.local/share/opencode/project/global/storage/session/message/**'],
      parser: { type: 'opencode' },
      filters: [],
      ttsService: {
        type: 'openai-compatible',
        baseUrl: 'http://your-service:8080/v1',
        apiKey: 'your-api-key-if-needed',
        voiceId: 'voice-1',
        model: 'your-model-name',
        options: {
          speed: 1.0,
          responseFormat: 'mp3'
        }
      }
    }
  ]
};