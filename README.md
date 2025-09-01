# Agent TTS

<img src="src/client/public/images/agent-tts.png" style="width:64px; height:64px;" alt="Agent TTS" />

Real-time text-to-speech for AI coding assistants. Talk with Claude, OpenCode, and other AI agents!

## Features

- 🎙️ **Real-time TTS**: Hear your AI agents speak as they respond
- 🤖 **Multi-agent support**: Works with Claude Code, OpenCode, and custom agents
- ⏯️ **Playback controls**: Pause, stop, skip messages
- 🎨 **Beautiful UI**: Modern React interface with dark mode support
- 🔊 **ElevenLabs integration**: High-quality voice synthesis
- ⌨️ **Global hotkeys**: Control playback from anywhere (Ctrl+Esc)
- 📊 **Message history**: Review and replay past messages
- 🔄 **Live updates**: WebSocket-powered real-time UI

## Installation

```bash
npm install -g agent-tts
```

## Quick Start

1. Create a configuration file at `~/.agent-tts/index.js`:

```javascript
export default {
  profiles: [
    {
      id: "claudia",
      name: "Claudia",
      avatar: "/images/claudia.png",
      enabled: true,
      parser: "claude-code",
      watch: ["~/.claude/projects/**/*.jsonl"],
      tts: {
        service: "elevenlabs",
        voiceId: "YOUR_VOICE_ID",
        model: "eleven_turbo_v2_5",
      },
      filters: ["markdown-cleaner", "pronunciation"],
    },
  ],
  elevenlabs: {
    apiKey: "YOUR_ELEVENLABS_API_KEY",
  },
};
```

2. Start the service:

```bash
agent-tts
```

3. Open your browser to `http://localhost:3456`

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

- `markdown-cleaner`: Removes markdown formatting
- `pronunciation`: Improves pronunciation (e.g., "git" → "ghit")
- `code-stripper`: Removes code blocks
- Custom filters can be added via configuration

## API

Agent TTS provides a REST API for integration:

- `POST /api/tts/stop` - Stop current playback
- `POST /api/tts/pause` - Pause playback
- `POST /api/tts/resume` - Resume playback
- `POST /api/tts/skip` - Skip current message
- `GET /api/profiles` - List all profiles
- `GET /api/logs` - Get message history
- `GET /api/status` - Get system status

## WebSocket Events

Connect to the WebSocket endpoint for real-time updates:

```javascript
const ws = new WebSocket("ws://localhost:3456/ws");

ws.on("message", (data) => {
  const event = JSON.parse(data);
  // Handle events: new-log, status-changed, config-error
});
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
- ElevenLabs API key for TTS
- macOS, Linux, or Windows

## License

MIT

## Credits

Created by Kiliman with assistance from Claude (Anthropic)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please visit [GitHub Issues](https://github.com/kiliman/agent-tts/issues)
