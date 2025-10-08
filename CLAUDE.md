# agent-tts

This app is a Node.js/Express application with a React frontend that monitors changes to files containing chat logs from various agents (Claude Code, OpenCode, etc.). It processes these logs via parser configs to generate messages for text-to-speech playback.

## Architecture

The application runs as a unified service on a single port (default: 3456), serving both the API and the frontend. It consists of:

- **Backend**: Express server with WebSocket support for real-time updates
- **Frontend**: React SPA with Tailwind CSS for styling
- **Database**: SQLite for persistent storage of logs, file tracking, and favorites
- **TTS Services**: Multiple providers (ElevenLabs, OpenAI, Kokoro) for text-to-speech generation
- **Audio Player**: Dedicated service for audio playback with proper process management

## Configuration

Configuration files are JavaScript/TypeScript files with default exports. Users can extend configurations by importing other config files and using spread operators.

Default configuration location: `~/.config/agent-tts/config.{js,ts}`

Configuration features:

- Hot-reload support with file watching
- Error reporting for syntax issues
- TypeScript support via `ts-blank-space` for type erasure
- Profile-based configuration for different agents

## File Locations (XDG Base Directory Specification)

The application follows the [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/latest/) for organizing user files:

- **Configuration**: `~/.config/agent-tts/` (or `$XDG_CONFIG_HOME/agent-tts/`)
  - `config.{js,ts}` - Main configuration file
  - `images/` - Custom avatar images
- **State/Database**: `~/.local/state/agent-tts/` (or `$XDG_STATE_HOME/agent-tts/`)
  - `agent-tts.db` - SQLite database
  - `logs/` - Application logs
  - `backups/` - Database backups
- **Cache**: `~/.cache/agent-tts/` (or `$XDG_CACHE_HOME/agent-tts/`)
  - `audio/YYYY-MM-DD/` - Generated audio files

## Database

Data is stored in a SQLite database. The default location: `~/.local/state/agent-tts/agent-tts.db`. Use the `sqlite3` CLI tool to manipulate the database.

Here is the schema:

### file_states

Tracks the last file size of appendable logs like Claude Code

- filepath TEXT PRIMARY KEY,
- last_modified INTEGER NOT NULL,
- file_size INTEGER NOT NULL,
- last_processed_offset INTEGER NOT NULL,
- updated_at INTEGER DEFAULT (strftime('%s', 'now')),
- profile TEXT DEFAULT 'default'

### tts_queue

Stores user and assistant messages, including state

- id INTEGER PRIMARY KEY AUTOINCREMENT,
- timestamp INTEGER NOT NULL,
- filename TEXT NOT NULL,
- profile TEXT NOT NULL,
- original_text TEXT NOT NULL,
- filtered_text TEXT NOT NULL,
- state TEXT CHECK (state IN ('queued', 'playing', 'played', 'error', 'user')) NOT NULL,
- api_response_status INTEGER,
- api_response_message TEXT,
- processing_time INTEGER,
- created_at INTEGER DEFAULT (strftime('%s', 'now')),
- is_favorite INTEGER DEFAULT 0,
- cwd TEXT,
- role TEXT CHECK (role IN ('user', 'assistant'))

## File Monitoring

The system monitors specified log files for changes:

1. On startup, reads all files specified in watch config
2. Maintains last modified date and file size in SQLite
3. When changes detected, reads new content from last offset
4. Sends content to profile-specific parser
5. Processes messages through filter chain
6. Queues filtered text for TTS playback

Features:

- One database row per monitored file
- Queue-based processing (one change at a time)
- Offset-based reading for efficiency

## Text-to-Speech

TTS implementation with multiple providers:

- **Providers**: ElevenLabs, OpenAI, and Kokoro (local) support
- **Audio Storage**: Permanent audio files saved to `~/.cache/agent-tts/audio/YYYY-MM-DD/profile-timestamp.mp3`
- **Audio Serving**: Audio files served via `/audio` route for browser and remote playback
- **Audio Replay**: Cached audio files are reused when replaying messages
- **Playback Modes**:
  - **Server-side**: Automatic playback on local machine when new messages arrive
  - **Browser-side**: Manual playback in web UI using HTML5 Audio API
  - **Remote**: Audio URLs accessible for mobile apps and remote clients
- **AudioPlayer Service**: Centralized audio playback with proper process management
- **Stoppable Playback**: Works for both new TTS generation and replayed audio files
- **Queue-based Processing**: Prevents audio overlap with proper queue management
- **Database Logging**: All TTS entries tracked with:
  - Timestamp and profile
  - Original and filtered text
  - Status (queued, playing, played, error)
  - Favorite status for memorable moments
  - API response details
  - Processing time
  - Audio URL for playback

## API Endpoints

- `POST /api/tts/stop` - Stop current playback
- `POST /api/tts/pause` - Pause playback
- `POST /api/tts/resume` - Resume playback
- `POST /api/tts/skip` - Skip current item
- `GET /api/profiles` - Get all profiles
- `PUT /api/profiles/:id` - Enable/disable profile
- `GET /api/logs` - Get log entries with pagination support
- `POST /api/logs/:id/replay` - Replay a log entry (uses cached audio if available)
- `POST /api/logs/:id/favorite` - Toggle favorite status
- `GET /api/favorites/count` - Get favorites count
- `GET /api/status` - Get system status
- `POST /api/config/reload` - Reload configuration

## UI Features

### Dashboard

- Profile cards with avatars and latest messages
- Favorites count with clickable navigation to filtered view
- Click to navigate to profile-specific pages
- Real-time status updates via WebSocket

### Profile Log Viewer

- Dedicated pages for each profile (e.g., `/claudia`, `/opencode`)
- Profile header with avatar and controls
- iOS-style toggle switches for:
  - Auto-scroll (smart detection skips during pagination)
  - Refresh
- **Infinite Scroll**: Load older messages by scrolling up
- **Favorites System**:
  - Heart icon to mark/unmark favorites
  - Click favorites count to view only favorites
  - URL parameter `?favorites` for filtered view
- Single-line log entries showing original text (click to expand)
- Expandable entries to view both original and filtered text
- **Browser-based Audio Playback**:
  - Play button to play audio directly in browser
  - Uses HTML5 Audio API for client-side playback
  - Works with both local and remote access (Tailscale, etc.)
- Visual states:
  - Grayscale for queued items
  - Green outline with pulse animation for currently playing
  - Red hearts for favorited items
  - Normal appearance for played items

### Design

- Dark mode support following system settings
- Tailwind CSS for styling
- Lucide React icons throughout
- Responsive layout

## WebSocket Events

Real-time updates for:

- New log entries (includes audio URL for playback)
- Status changes (playing/stopped)
- Configuration errors
- Profile updates

## Resource URLs

The application serves static resources with environment-aware URL generation:

- **Development Mode**: Full URLs with host and port (e.g., `http://localhost:3456/audio/...`)
  - Client runs on different port (5173) than server (3456)
  - Resources use absolute URLs to access server
- **Production Mode**: Relative URLs (e.g., `/audio/...`, `/images/...`)
  - Client and server run on same origin
  - Relative URLs work with any access method (localhost, Tailscale, remote)
  - Enables seamless remote access without hardcoded domains

## Global Controls

- Stop playback via API endpoint `/api/tts/stop`
- Can be triggered by Better Touch Tool with Control+Escape
- Mute toggle functionality

## Development

```bash
# Development with hot reload (unified)
npm run dev

# Development with separate frontend/backend
npm run dev:separate

# Production build
npm run build

# Start production server
npm run start:prod

# Start with CLI
agent-tts  # Production mode (serves built frontend)

# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Run tests once (CI mode)
npm run test:run
```

## CLI Options

The `agent-tts` command supports the following flags:

- `--server` - Run only the backend server
- `--client` - Run only the frontend dev server (Vite)
- `--help` or `-h` - Show help message

If no flags are specified, both server and client run in production mode (serves built frontend).

## Configuration

Environment variables:

- `PORT` - Server port (default: 3456)
- `CLIENT_PORT` - Client dev server port (default: 5173)
- `HOST` - Server host (default: localhost)
- `NODE_ENV` - Environment (development/production)

Config file options:

```typescript
{
  serverPort?: number;    // Backend API port (default: 3456)
  clientPort?: number;    // Frontend dev server port (default: 5173)
  profiles: ProfileConfig[];
  // ... other config options
}
```

## Key Implementation Details

1. **Parser Architecture**: Modular parsers for different agent formats with content filtering
2. **Filter Chain**: Text transformation pipeline for TTS optimization
3. **AudioPlayer Service**: Centralized audio playback with proper process management
4. **TTS Service Architecture**: Clean separation between TTS generation and playback
5. **Audio Caching**: Permanent storage and reuse of generated audio files
6. **WebSocket Integration**: Real-time UI updates without polling
7. **Virtual Pagination**: Efficient infinite scroll with deduplication
8. **Single-Port Deployment**: Simplified deployment with Express serving React build
9. **Protocol Detection**: Automatic ws:// vs wss:// based on page protocol

## Parser Content Filtering

The Claude Code parser includes sophisticated filtering to prevent unwanted messages from being processed for TTS:

### Filtered Content Types

1. **Meta Messages**: Messages with `isMeta: true` are automatically skipped (e.g., command caveats)
2. **Command Tags**: Messages containing local command execution tags are filtered out:
   - `<command-name>` and `</command-name>`
   - `<command-message>` and `</command-message>`
   - `<command-args>` and `</command-args>`
   - `<local-command-stdout>` and `</local-command-stdout>`
3. **Caveat Messages**: Pattern-based detection of command warnings:
   - "Caveat: The messages below were generated by the user while running local commands..."
4. **Empty Content**: Messages with no content or only whitespace are skipped

### Implementation Details

- **Location**: `src/parsers/claude-code-parser.ts`
- **Method**: `isCommandMessage()` with regex pattern matching
- **Testing**: Comprehensive test suite in `test/claude-code-parser.test.ts` using Vitest
- **Build Process**: TypeScript compilation to `dist/server/parsers/`

This filtering ensures only legitimate user and assistant conversations are sent to TTS services, preventing system-generated command messages from being spoken aloud.
