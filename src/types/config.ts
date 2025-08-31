export interface ProfileConfig {
  id: string;
  name: string;
  icon?: string;
  enabled?: boolean;
  watchPaths: string[];
  parser: ParserConfig;
  filters: FilterConfig[];
  ttsService: TTSServiceConfig;
}

export interface ParserConfig {
  type: "claude-code" | "opencode" | "custom";
  customParser?: (content: string) => ParsedMessage[];
}

export interface ParsedMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
}

export interface FilterConfig {
  name: string;
  enabled?: boolean;
  filter: (message: ParsedMessage) => ParsedMessage | null;
}

export interface TTSServiceConfig {
  type: "elevenlabs" | "openai" | "custom";
  apiKey?: string;
  voiceId?: string;
  model?: string;
  baseUrl?: string;
  avatarUrl?: string; // URL to avatar image (PNG/JPG)
  profileUrl?: string; // URL to profile image (PNG/JPG)
  voiceName?: string; // Display name for the voice
  options?: Record<string, any>;
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
  state: "queued" | "playing" | "played" | "error";
  apiResponseStatus?: number;
  apiResponseMessage?: string;
  processingTime?: number;
}
