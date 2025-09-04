export interface ProfileConfig {
  id: string;
  name: string;
  icon?: string;
  enabled?: boolean;
  model?: string; // Model name (e.g., "Claude Sonnet", "Grok Code Fast 1")
  modelIconUrl?: string; // URL to model icon (e.g., /images/claude.png)
  watchPaths: string[];
  parser: ParserConfig;
  filters: FilterConfig[];
  ttsService: TTSServiceConfig;
}

export interface ParserConfig {
  type: "claude-code" | "opencode" | "custom";
  name?: string; // Display name for the tool (e.g., "Claude Code", "OpenCode")
  iconUrl?: string; // URL to tool icon (e.g., /images/claude-code.png)
  customParser?: (content: string) => ParsedMessage[];
}

export interface ParsedMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  cwd?: string;
}

export interface FilterConfig {
  name: string;
  enabled?: boolean;
  options?: any; // Filter-specific options (e.g., pronunciation replacements)
  filter?: (message: ParsedMessage) => ParsedMessage | null; // Custom filter function
}

export interface TTSServiceConfig {
  type: "elevenlabs" | "openai" | "kokoro" | "openai-compatible" | "custom";
  apiKey?: string;
  voiceId?: string;
  model?: string;
  baseUrl?: string;
  avatarUrl?: string; // URL to avatar image (PNG/JPG)
  profileUrl?: string; // URL to profile image (PNG/JPG)
  voiceName?: string; // Display name for the voice
  options?: {
    // ElevenLabs options
    stability?: number;
    similarityBoost?: number;
    
    // OpenAI/Kokoro options
    speed?: number;
    responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
    
    // Any additional provider-specific options
    [key: string]: any;
  };
}

export interface AgentTTSConfig {
  profiles: ProfileConfig[];
  globalHotkey?: string;
  muted?: boolean;
  databasePath?: string;
  configPath?: string;
}

export interface FileState {
  filepath: string;
  lastModified: number;
  fileSize: number;
  lastProcessedOffset: number;
}

export interface TTSQueueEntry {
  id?: number;
  timestamp: Date;
  filename: string;
  profile: string;
  originalText: string;
  filteredText: string;
  state: "queued" | "playing" | "played" | "error" | "user";
  apiResponseStatus?: number;
  apiResponseMessage?: string;
  processingTime?: number;
  isFavorite?: boolean;
  cwd?: string;
  role?: "user" | "assistant"; // Track the role for proper display
}
