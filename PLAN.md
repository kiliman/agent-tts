# agent-tts Implementation Plan

## Overview

An Electron app that monitors agent chat logs (claude-code, opencode, etc.), processes them through configurable parsers and filters, then converts messages to speech using TTS services like ElevenLabs.

## Architecture Components

### 1. Configuration System

- **Location**: `~/.agent-tts/index.{js,ts}` (default)
- **Hot-reload**: Monitor config directory for changes
- **Dynamic loading**: Use `ts-blank-space` to strip TypeScript types for runtime evaluation
- **Error handling**: Robust syntax error reporting, don't replace config until valid
- **Type safety**: Validate loaded config against TypeScript interfaces

### 2. File Monitoring System

- **Technology**: `chokidar` for file watching
- **State persistence**: SQLite database to track file states (path, lastModified, size)
- **Incremental reading**: Read only new content from last known file size offset
- **Queue management**: Single-threaded processing with change queue
- **Profile-based**: Each profile defines its own watch patterns and exclusions

### 3. Message Processing Pipeline

```
File Change → Read New Content → Parse Messages → Apply Filters → Queue TTS
```

- **Parser**: Profile-specific function that extracts messages from log content
- **Filters**: Chain of transformations (built-in + custom) for speech optimization
- **Pronunciation rules**: Pattern-based replacements (e.g., `git` → `ghit`)

### 4. TTS Service Layer

- **Service abstraction**: Base class with async `tts(text: string)` method
- **ElevenLabs implementation**: Handle API calls, audio playback
- **Queue management**: Sequential processing to prevent audio overlap
- **Logging**: Comprehensive SQLite logging of all TTS operations

### 5. Electron Menu Bar App

- **System tray**: Menu bar icon with context menu
- **Profile controls**: Toggle profiles on/off with checkmarks
- **Global mute**: Toggle all TTS playback
- **Global hotkey**: Configurable stop key (default: Ctrl+Esc)
- **Persistent state**: Save profile enable/disable states

### 6. React UI (Log Viewer)

- **Window management**: Separate log viewer window
- **Log display**: Last 50 entries with profile icons, truncated text
- **Expandable entries**: Show original vs filtered text
- **Playback controls**: Play/pause individual entries
- **Status indicators**: Queue spinner, playing/paused states
- **Auto-scroll**: Follow new entries
- **Theme support**: Light/dark mode following system preference

## Database Schema

### `file_states` table

```sql
CREATE TABLE file_states (
  file_path TEXT PRIMARY KEY,
  profile TEXT NOT NULL,
  last_modified INTEGER NOT NULL,
  file_size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### `tts_log` table

```sql
CREATE TABLE tts_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  profile TEXT NOT NULL,
  original_text TEXT NOT NULL,
  filtered_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'played', 'error')),
  tts_status INTEGER,
  tts_message TEXT,
  elapsed_ms INTEGER,
  created_at INTEGER NOT NULL
);
```

### `app_settings` table

```sql
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

## Project Structure

```
src/
├── main/                    # Electron main process
│   ├── main.ts             # Entry point, app lifecycle
│   ├── menu.ts             # System tray menu
│   ├── hotkeys.ts          # Global hotkey registration
│   └── windows.ts          # Window management
├── config/                  # Configuration system
│   ├── loader.ts           # Dynamic config loading with ts-blank-space
│   ├── validator.ts        # Config validation
│   └── watcher.ts          # Config file monitoring
├── monitoring/              # File monitoring system
│   ├── file-watcher.ts     # chokidar wrapper
│   ├── change-processor.ts # Process file changes
│   └── message-queue.ts    # Change processing queue
├── processing/              # Message processing
│   ├── parsers/            # Built-in parsers
│   │   ├── claude-code.ts  # Claude Code log parser
│   │   └── opencode.ts     # OpenCode log parser
│   ├── filters/            # Built-in filters
│   │   ├── code-stripper.ts
│   │   ├── pronunciation.ts
│   │   └── index.ts        # Filter registry
│   └── pipeline.ts         # Processing coordination
├── tts/                     # TTS service layer
│   ├── base.ts             # Abstract TTS service
│   ├── elevenlabs.ts       # ElevenLabs implementation
│   ├── queue.ts            # TTS playback queue
│   └── audio-player.ts     # Audio playback utilities
├── database/                # SQLite operations
│   ├── schema.ts           # Database schema & migrations
│   ├── file-states.ts      # File state operations
│   ├── tts-log.ts          # TTS log operations
│   └── settings.ts         # App settings operations
├── renderer/                # React UI
│   ├── components/
│   │   ├── LogViewer.tsx   # Main log view component
│   │   ├── LogEntry.tsx    # Individual log entry
│   │   └── Controls.tsx    # Playback controls
│   ├── hooks/
│   │   ├── useTheme.ts     # System theme detection
│   │   └── useTTSLog.ts    # TTS log data management
│   └── main.tsx            # React app entry
└── shared/                  # Shared utilities
    ├── types.ts            # Move from global.d.ts
    ├── ipc.ts              # IPC channel definitions
    └── utils.ts            # Common utilities
```

## Implementation Phases

### Phase 1: Core Infrastructure

1. **Project setup**: Electron + TypeScript + React toolchain
2. **Database layer**: SQLite schema and operations
3. **Configuration system**: Dynamic loading with hot-reload
4. **Basic file monitoring**: chokidar integration

### Phase 2: Processing Pipeline

1. **Message parsers**: Claude Code and OpenCode log parsers
2. **Filter system**: Built-in filters (code stripping, pronunciations)
3. **Processing queue**: Sequential message processing
4. **TTS service**: ElevenLabs integration with playback

### Phase 3: Electron App

1. **Main process**: App lifecycle and system tray
2. **Menu system**: Profile toggles and controls
3. **Global hotkeys**: Stop TTS playback
4. **Settings persistence**: Profile states and preferences

### Phase 4: React UI

1. **Log viewer**: Component structure and layout
2. **Log entries**: Expandable entries with playback controls
3. **Theme support**: Light/dark mode
4. **IPC integration**: Communication with main process

### Phase 5: Polish & Testing

1. **Error handling**: Comprehensive error recovery
2. **Performance optimization**: Efficient file monitoring and processing
3. **User experience**: Smooth interactions and feedback
4. **Documentation**: Configuration examples and usage guide

## Key Questions for Clarification

1. **Default parsers**: Claude Code uses JSONL formatted files. Use JSON.parse for each line. We are primarily interested in entries with messages from the assistant.

2. **Built-in filters**: Use the existing `example/tts-processor.ts` as a roadmap. Key filters include:
   - JSON/XML content filtering
   - Code block removal (``` and `)
   - Markdown formatting removal  
   - Tool results and system reminders removal
   - File path simplification
   - Symbol replacement (===, !=, etc.)
   - Whitespace cleanup
   - Pronunciation fixes (git → ghit, etc.)

3. **Profile icons**: Add `iconPath` to ProfileConfig - any image (PNG, JPEG, SVG) relative to config directory.

4. **TTS services**: Support multiple TTS APIs with extensible design, focus on ElevenLabs first.

5. **Configuration validation**: 
   - Startup errors: Show error window, don't start watchers until config loads successfully
   - Hot-reload errors: Show detailed error, continue with current config until new config loads
   - Config changes: Stop watchers, wait for playback to finish, reinitialize

6. **File patterns**: Use chokidar globs as configured in profiles.

7. **Audio format**: Default to `mp3_44100_128`, make `outputFormat` part of TTSServiceConfig. Stream audio (no caching).

8. **Error recovery**: Show errors in UI to distinguish app errors from network/service issues. Log all failures with details.

This plan provides a comprehensive roadmap while remaining flexible for adjustments based on your feedback and requirements clarification.
