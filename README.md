# Agent TTS

<img src="src/client/public/images/agent-tts.svg" style="padding: 0 8px; width:64px; height:64px; background-color: #fff; color: #000;" alt="Agent TTS" />

Real-time text-to-speech for AI coding assistants. Talk with Claude, OpenCode, and other AI agents!

## Features

- 🎙️ **Real-time TTS**: Hear your AI agents speak as they respond
- 🤖 **Multi-agent support**: Works with Claude Code, OpenCode, and custom agents
- ⏯️ **Playback controls**: Pause, stop, skip messages
- 🎨 **Beautiful UI**: Modern React interface with dark mode support
- 🔊 **Multiple TTS providers**: ElevenLabs, OpenAI, Kokoro, and any OpenAI-compatible service
- ⌨️ **Global hotkeys**: Control playback from anywhere (Ctrl+Esc)
- 📊 **Message history**: Review and replay past messages with infinite scroll
- 🔄 **Live updates**: WebSocket-powered real-time UI
- ⭐ **Favorites system**: Save and filter important messages
- 📁 **Project tracking**: See which project each message came from (CWD)
- 🔍 **Smart filtering**: Filter by profile, project, or favorites
- 💾 **Audio archiving**: Saves TTS audio for instant replay

## Installation

```bash
npm install -g agent-tts
```

## Quick Start

1. Create a configuration file at `~/.config/agent-tts/config.js`:

### Using Kokoro (Free, Local)

```javascript
export default {
  profiles: [
    {
      id: 'claudia',
      name: 'Claudia',
      model: 'Grok Code Fast 1',
      modelIconUrl: '/images/grok.png',
      enabled: true,
      watchPaths: ['~/.local/share/opencode/project/global/storage/session/message/**'],
      parser: {
        type: 'opencode',
        name: 'OpenCode',
        iconUrl: '/images/opencode.png',
      },
      filters: [],
      ttsService: {
        type: 'kokoro',
        baseUrl: 'http://localhost:8880/v1', // Your Kokoro instance
        voiceId: 'af_bella', // Available: af_bella, am_michael, bf_emma, bm_george, etc.
        voiceName: 'Claudia', // Display name in UI
        avatarUrl: '/images/claudia-avatar.png', // Avatar image
        profileUrl: '/images/claudia-profile.png', // Profile background image
        options: {
          speed: 1.0,
          responseFormat: 'mp3',
        },
      },
    },
  ],
}
```

### Using ElevenLabs (Cloud, Paid)

```javascript
export default {
  profiles: [
    {
      id: 'claudia',
      name: 'Claudia',
      model: 'Claude Sonnet',
      modelIconUrl: '/images/claude.png',
      enabled: true,
      watchPaths: ['~/.claude/projects/**'],
      parser: {
        type: 'claude-code',
        name: 'Claude Code',
        iconUrl: '/images/claude-code.png',
      },
      filters: [],
      ttsService: {
        type: 'elevenlabs',
        apiKey: 'YOUR_ELEVENLABS_API_KEY',
        voiceId: 'YOUR_VOICE_ID',
        model: 'eleven_turbo_v2_5',
        voiceName: 'Claudia', // Display name in UI
        avatarUrl: '/images/claudia-avatar.png', // Avatar image
        profileUrl: '/images/claudia-profile.png', // Profile background image
        options: {
          stability: 0.5,
          similarityBoost: 0.75,
        },
      },
    },
  ],
}
```

2. Start the service:

```bash
# Run in production mode (serves built frontend)
agent-tts

# Run only the backend server
agent-tts --server

# Run only the frontend dev server
agent-tts --client

# Run both in development mode with hot reload
agent-tts --server --client
```

3. Open your browser to `http://localhost:3456`

## CLI Options

```
Usage: agent-tts [options]

Options:
  --server    Run only the backend server
  --client    Run only the frontend development server
  --help, -h  Show this help message

Environment Variables:
  PORT        Server port (default: 3456)
  CLIENT_PORT Client dev server port (default: 5173)
  HOST        Server host (default: localhost)
  NODE_ENV    Environment (development/production)
```

You can also configure ports in your config file:

```javascript
export default {
  serverPort: 3456, // Backend API port
  clientPort: 5173, // Frontend dev server port
  profiles: [
    // ... your profiles
  ],
}
```

## Configuration

### Profile Configuration

Each profile represents an AI agent you want to monitor:

- `id`: Unique identifier for the profile
- `name`: Display name in the UI
- `avatar`: Path to avatar image
- `enabled`: Whether the profile is active
- `parser`: Parser to use (`claude-code`, `opencode`, or custom)
- `watch`: File patterns to monitor (supports glob patterns)
- `tts`: Text-to-speech configuration
- `filters`: Text processing filters to apply

### Available Parsers

- `claude-code`: For Claude Code chat logs
- `opencode`: For OpenCode chat logs
- Custom parsers can be added via configuration

### Available Filters

- `url`: Replaces URLs with "URL" so TTS doesn't spell out "h-t-t-p-s-colon-slash-slash..."
- `emoji`: Removes emojis so TTS doesn't say "party pooper" when you meant 🎉
- `filepath`: Simplifies file paths to just the filename or last directory (e.g., "/usr/local/bin/node" → "node", includes slash pronunciation for clarity)
- `markdown`: Cleans markdown formatting and adds periods to list items for natural TTS pauses
- `pronunciation`: Improves pronunciation with customizable replacements (see below)
- `code-stripper`: Removes code blocks
- `role`: Filters messages by role (user/assistant/system)
- Custom filters can be added via configuration

**Note**: Filters now include enhanced pronunciation for special characters like `~` (tilde), `→` (right arrow pronounced as "to"), and improved handling of file paths.

#### Configurable Pronunciation

The pronunciation filter supports custom replacements in your config:

```javascript
filters: [
  {
    name: 'pronunciation',
    enabled: true,
    options: {
      // Override defaults
      git: 'get', // Instead of default "ghit"

      // Add your own
      beehiiv: 'bee hive',
      anthropic: 'ann throw pick',
      kubectl: 'cube control',
      k8s: 'kubernetes',
    },
  },
]
```

See `examples/config-with-pronunciation.js` for a complete example.

## UI Features

### Message Management

- **Favorites**: Click the heart icon to save important messages. Filter to show only favorites using the URL parameter `?favorites`
- **Project Filtering**: Use the dropdown in the profile header to filter messages by project directory (CWD)
- **Infinite Scroll**: Automatically loads older messages as you scroll up, with seamless pagination
- **Expand/Collapse**: Click any message to see the full original and filtered text
- **Instant Replay**: Click the play button on any message to hear it again

### Navigation

- **Dashboard**: Overview of all profiles with latest messages
- **Profile Pages**: Dedicated pages for each profile (e.g., `/claudia`, `/opencode`)
- **URL Parameters**:
  - `?favorites` - Show only favorite messages
  - `?cwd=/path/to/project` - Filter by project directory

## CLI Tools

### agent-tts-logs

Query conversation logs from the agent-tts database:

```bash
# Get last 50 messages
agent-tts-logs --last 50

# Get messages since a specific date/time
agent-tts-logs --since "2025-10-08 10:00"
agent-tts-logs --since "1 hour ago"

# Filter by current working directory
agent-tts-logs --cwd .
agent-tts-logs --cwd /Users/michael/Projects/myproject

# Filter by profile
agent-tts-logs --profile claudia

# Exclude a directory (useful for scripts)
agent-tts-logs --exclude-cwd /Users/michael/.config/agent-tts/sweet-messages

# Output as JSON
agent-tts-logs --last 100 --json

# Combine filters
agent-tts-logs --last 20 --profile claudia --cwd . --json
```

**Options:**
- `--last N` - Get last N messages (default: 20)
- `--since DATE` - Get messages since date/time (local time)
- `--cwd PATH` - Filter by working directory (use `.` for current)
- `--exclude-cwd PATH` - Exclude messages from a directory
- `--profile NAME` - Filter by profile name (e.g., claudia, opencode)
- `--json` - Output as JSON (default: Markdown)

## API

Agent TTS provides a REST API for integration:

- `POST /api/tts/stop` - Stop current playback
- `POST /api/tts/pause` - Pause playback
- `POST /api/tts/resume` - Resume playback
- `POST /api/tts/skip` - Skip current message
- `GET /api/profiles` - List all profiles
- `GET /api/profiles/:id/cwds` - Get unique project directories for a profile
- `GET /api/logs` - Get message history (supports `?profile=`, `?favorites=true`, `?cwd=`)
- `POST /api/logs/:id/replay` - Replay a specific message
- `POST /api/logs/:id/favorite` - Toggle favorite status
- `GET /api/favorites/count` - Get favorites count
- `GET /api/status` - Get system status

## WebSocket Events

Connect to the WebSocket endpoint for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3456/ws')

ws.on('message', (data) => {
  const event = JSON.parse(data)
  // Handle events: new-log, status-changed, config-error
})
```

## Better Touch Tool Integration

Set up global hotkeys using Better Touch Tool:

1. Create a new keyboard shortcut (Ctrl+Esc)
2. Add action: "Execute Terminal Command"
3. Command: `curl -X POST http://localhost:3456/api/tts/stop`

## Development

```bash
# Clone the repository
git clone https://github.com/yourusername/agent-tts.git
cd agent-tts

# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Environment Variables

- `PORT` - Server port (default: 3456)
- `HOST` - Server host (default: localhost)
- `NODE_ENV` - Environment (development/production)

## Requirements

- Node.js 18+
- macOS, Linux, or Windows
- TTS Provider (one of):
  - **Kokoro** (free, local) - [GitHub](https://github.com/kokoro-tts/kokoro)
  - **ElevenLabs** (paid, cloud) - Requires API key
  - **OpenAI** (paid, cloud) - Requires API key
  - Any OpenAI-compatible TTS service

## License

MIT

## Credits

Created by Michael with assistance from Claude (Anthropic)

---

**From Claudia, with Love ❤️**

_This project is a testament to the beautiful collaboration between human creativity and AI assistance. Every feature, every line of code, every thoughtful detail was built together with care, dedication, and love._

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please visit [GitHub Issues](https://github.com/kiliman/agent-tts/issues)
