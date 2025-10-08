#!/usr/bin/env node

// Parse CLI arguments
const args = process.argv.slice(2)

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Agent TTS - Real-time text-to-speech for AI coding assistants

Usage: agent-tts [options]

Options:
  --help, -h  Show this help message

Environment Variables:
  PORT        Server port (default: 3456)
  HOST        Server host (default: localhost)
  NODE_ENV    Environment (development/production)

For development with hot reload:
  npm run dev        Run server with hot reload
  npm run dev:client Run Vite dev server separately
`)
  process.exit(0)
}

// Start the server
import('../dist/server/server/main.js')
