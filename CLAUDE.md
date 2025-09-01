# agent-tts

This app is a Node.js/Express application with a React frontend that monitors changes to files containing chat logs from various agents (Claude Code, OpenCode, etc.). It processes these logs via parser configs to generate messages for text-to-speech playback.

## Architecture

The application runs as a unified service on a single port (default: 3456), serving both the API and the frontend. It consists of:

- **Backend**: Express server with WebSocket support for real-time updates
- **Frontend**: React SPA with Tailwind CSS for styling
- **Database**: SQLite for persistent storage of logs and file tracking
- **TTS Service**: ElevenLabs integration with stoppable audio playback

## Configuration

Configuration files are JavaScript/TypeScript files with default exports. Users can extend configurations by importing other config files and using spread operators.

Default configuration location: `~/.agent-tts/index.{js,ts}`

Configuration features:
- Hot-reload support with file watching
- Error reporting for syntax issues
- TypeScript support via `ts-blank-space` for type erasure
- Profile-based configuration for different agents

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

TTS implementation using ElevenLabs:

- Stoppable audio playback using child processes (`afplay` on macOS)
- Queue-based processing to prevent audio overlap
- Database logging of all TTS entries with:
  - Timestamp
  - Filename and profile
  - Original and filtered text
  - Status (queued, playing, played, error)
  - API response details
  - Processing time

## API Endpoints

- `POST /api/tts/stop` - Stop current playback
- `POST /api/tts/pause` - Pause playback
- `POST /api/tts/resume` - Resume playback
- `POST /api/tts/skip` - Skip current item
- `GET /api/profiles` - Get all profiles
- `PUT /api/profiles/:id` - Enable/disable profile
- `GET /api/logs` - Get log entries
- `POST /api/logs/:id/replay` - Replay a log entry
- `GET /api/status` - Get system status
- `POST /api/config/reload` - Reload configuration

## UI Features

### Dashboard
- Profile cards with avatars and latest messages
- Click to navigate to profile-specific pages
- Real-time status updates via WebSocket

### Profile Log Viewer
- Dedicated pages for each profile (e.g., `/claudia`, `/opencode`)
- Profile header with avatar and controls
- iOS-style toggle switches for:
  - Auto-scroll
  - Refresh
- Single-line log entries showing original text
- Expandable entries to view filtered text
- Replay functionality for individual entries
- Visual states:
  - Grayscale for queued items
  - Green outline for currently playing
  - Normal appearance for played items

### Design
- Dark mode support following system settings
- Tailwind CSS for styling
- Lucide React icons throughout
- Responsive layout

## WebSocket Events

Real-time updates for:
- New log entries
- Status changes (playing/stopped)
- Configuration errors
- Profile updates

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
```

Environment variables:
- `PORT` - Server port (default: 3456)
- `HOST` - Server host (default: localhost)
- `NODE_ENV` - Environment (development/production)

## Key Implementation Details

1. **Parser Architecture**: Modular parsers for different agent formats
2. **Filter Chain**: Text transformation pipeline for TTS optimization
3. **Child Process Audio**: Stoppable playback using system commands
4. **WebSocket Integration**: Real-time UI updates without polling
5. **Single-Port Deployment**: Simplified deployment with Express serving React build
6. **Protocol Detection**: Automatic ws:// vs wss:// based on page protocol