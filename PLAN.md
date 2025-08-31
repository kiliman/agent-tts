# Migration Plan: Electron to Node.js Web Service

## Architecture Overview
Transform the current Electron desktop app into a Node.js background service with web-based UI and REST API for external control via tools like BetterTouchTool.

## Core Components

### 1. Node.js Backend Service (Express + Vite)
- **Express Server**: REST API and WebSocket support
- **Vite**: Dev server with HMR for frontend, production build
- **Port**: 3456 (configurable)
- **Auto-start**: systemd/launchd service or PM2

### 2. Web-based UI
- **React SPA**: Served by Express
- **Real-time updates**: WebSocket/Server-Sent Events
- **Features**: Log viewer, profile management, settings
- **Access**: http://localhost:3456
- **No authentication**: Local-only personal tool

### 3. REST API Endpoints
```
POST   /api/tts/pause          - Pause current playback
POST   /api/tts/resume         - Resume playback  
POST   /api/tts/stop           - Stop and clear queue
POST   /api/tts/skip           - Skip current message
GET    /api/profiles           - List all profiles
PUT    /api/profiles/:id       - Toggle profile enabled
GET    /api/logs               - Get TTS log entries
POST   /api/logs/:id/replay    - Replay log entry
GET    /api/status             - Service status
PUT    /api/settings/mute      - Toggle global mute
POST   /api/config/reload      - Reload configuration
```

### 4. Core Services (Preserved)
- **AppCoordinator**: Main orchestrator
- **FileMonitor**: Watch agent log files
- **MessageProcessor**: Parse and filter messages
- **TTSQueue**: Queue and play audio
- **Database**: SQLite for state/logs

## Migration Steps

### Phase 1: Setup Node.js Project
1. Update package.json - remove Electron deps, add Express
2. Configure Vite for Node.js backend + React frontend
3. Setup TypeScript configs for server and client

### Phase 2: Backend Migration
1. Create Express server with API routes
2. Port AppCoordinator to Node context
3. Remove Electron IPC, use EventEmitter/WebSocket
4. Migrate settings from electron-store to SQLite/JSON

### Phase 3: Frontend Migration
1. Move React app to web context
2. Replace Electron APIs with REST calls
3. Add WebSocket for real-time updates
4. Store preferences in browser localStorage

### Phase 4: External Integration
1. Document API for BetterTouchTool
2. Create example BTT shortcuts
3. Optional: CLI client for terminal control

### Phase 5: Service Management
1. Create startup scripts (systemd/launchd)
2. Add PM2 configuration
3. Setup logging and monitoring

## Benefits
- **Simpler architecture**: Pure Node.js, no Electron complexity
- **External control**: Any tool can call REST API
- **Resource efficient**: Lower memory usage
- **Flexible deployment**: Run anywhere Node runs
- **Better debugging**: Standard web dev tools
- **No authentication overhead**: Simple local service

## Configuration Changes
- Config stays at `~/.agent-tts/`
- Add `port` and `host` settings
- Web UI preferences stored in browser localStorage

## BetterTouchTool Integration Example
```bash
# Pause playback
curl -X POST http://localhost:3456/api/tts/pause

# Toggle mute
curl -X PUT http://localhost:3456/api/settings/mute

# Skip current message
curl -X POST http://localhost:3456/api/tts/skip

# Stop all playback
curl -X POST http://localhost:3456/api/tts/stop
```

## Project Structure
```
agent-tts/
├── src/
│   ├── server/           # Express server & API
│   │   ├── main.ts       # Server entry point
│   │   ├── api/          # API route handlers
│   │   └── websocket.ts  # WebSocket handler
│   ├── client/           # React frontend
│   │   ├── main.tsx      # Client entry point
│   │   ├── App.tsx       # Main app component
│   │   └── components/   # React components
│   ├── services/         # Core services (preserved)
│   ├── parsers/          # Agent parsers (preserved)
│   ├── filters/          # Message filters (preserved)
│   └── database/         # Database layer (preserved)
├── vite.config.ts        # Vite configuration
├── package.json          # Dependencies & scripts
└── tsconfig.json         # TypeScript config
```