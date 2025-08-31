import type { AgentTTSConfig, TTSServiceConfig } from '../src/types/config';
import { markdownCleaner } from '../src/filters/markdown-cleaner';

// Base ElevenLabs configuration - shared across all profiles
const baseElevenLabsConfig: TTSServiceConfig = {
  type: 'elevenlabs',
  apiKey: process.env.ELEVENLABS_API_KEY || 'your-api-key-here',
  model: 'eleven_turbo_v2_5', // Using the turbo v2.5 model
  options: {
    stability: 0.5,
    similarityBoost: 0.75
  }
};

// Voice presets for different agents
const voices = {
  sarah: 'EXAVITQu4vr4xnSDxMaL',
  adam: 'pNInz6obpgDQGcFmaJgB',
  bella: '21m00Tcm4TlvDq8ikWAM',
  elli: 'MF3mGyEYCl7XYWbV9V6O'
};

const config: AgentTTSConfig = {
  profiles: [
    {
      id: 'claude-code',
      name: 'Claude Code',
      icon: '🤖',
      enabled: true,
      watchPaths: [
        '~/.claude-trace/claude-code.jsonl'
      ],
      parser: {
        type: 'claude-code'
      },
      filters: [
        {
          name: 'markdown-cleaner',
          enabled: true,
          filter: markdownCleaner
        },
        {
          name: 'pronunciation',
          enabled: true,
          filter: (message) => {
            // Fix common pronunciation issues
            return {
              ...message,
              content: message.content
                .replace(/\bgit\b/gi, 'ghit')
                .replace(/\bGit\b/g, 'Ghit')
                .replace(/\\/g, ' backslash ')
            };
          }
        }
      ],
      ttsService: {
        ...baseElevenLabsConfig,
        voiceId: voices.sarah, // Sarah voice for Claude
        options: {
          ...baseElevenLabsConfig.options,
          // Override specific settings for Claude if needed
          stability: 0.5
        }
      }
    },
    {
      id: 'opencode',
      name: 'OpenCode',
      icon: '💻',
      enabled: false,
      watchPaths: [
        '~/.opencode/logs/chat.log'
      ],
      parser: {
        type: 'opencode'
      },
      filters: [],
      ttsService: {
        ...baseElevenLabsConfig,
        voiceId: voices.adam, // Adam voice for OpenCode
        options: {
          ...baseElevenLabsConfig.options,
          // Different voice settings for OpenCode
          stability: 0.6,
          similarityBoost: 0.8
        }
      }
    }
  ],
  globalHotkey: 'Ctrl+Esc',
  muted: false,
  databasePath: '~/.agent-tts/db.sqlite',
  configPath: '~/.agent-tts'
};

export default config;