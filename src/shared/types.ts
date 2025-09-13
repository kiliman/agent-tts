export interface PronunciationRule {
  pattern: string | RegExp;
  replacement: string;
  caseSensitive?: boolean;
}

export interface AgentChatLog {
  filePath: string; // file that was changed (one entry per file)
  profile: string; // profile name
  lastModified: number; // modified timestamp in epoch ms
  size: number; // file size in bytes
}

export interface TTSLogEntry {
  timestamp: number; // epoch ms
  filePath: string; // file that was changed
  profile: string; // profile name
  originalText: string;
  filteredText: string;
  status: "queued" | "played" | "error";
  ttsStatus: number;
  ttsMessage: string;
  elapsed: number;
  cwd?: string; // current working directory
  role?: "user" | "assistant"; // Track the role for proper display
}

export type FilterFunction = (text: string) => string;
export type CustomFilter = Record<string, FilterFunction>;
export type TTSParserFunction = (text: string) => string[];

export interface TTSServiceConfig {
  name: string; // e.g., "elevenlabs"
  parser: TTSParserFunction; // function to parse log text into individual messages for TTS
  outputFormat?: string; // e.g., "mp3_44100_128"
  voice: {
    id: string;
    model: string;
    stability: number;
    similarityBoost: number;
  };
}

export interface ProfileConfig {
  name: string; // profile name
  iconPath?: string; // path to profile icon (PNG, JPEG, SVG) relative to config directory
  watch: string[]; // chokidar patterns to watch files
  exclude?: string[]; // Optional patterns to exclude files
  tts: TTSServiceConfig; // TTS service configuration
  pronunciations: PronunciationRule[]; // pronunciation rules
  filters: {
    enabled: string[]; // names of built-in filters to enable, default to `*` (all)
    disabled: string[]; // names of built-in filters to disable
    custom: CustomFilter[]; // custom filters
  };
}

// Root configuration interface
// default export from `~/.agent-tts/index.ts`
export interface AppConfig {
  profiles: ProfileConfig[];
}
