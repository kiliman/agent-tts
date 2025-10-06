#!/usr/bin/env node

// Parse CLI arguments
const args = process.argv.slice(2);
const flags = {
  server: args.includes('--server'),
  client: args.includes('--client'),
  help: args.includes('--help') || args.includes('-h'),
};

// If no flags specified, run both (default behavior)
if (!flags.server && !flags.client && !flags.help) {
  flags.server = true;
  flags.client = true;
}

// Show help
if (flags.help) {
  console.log(`
Agent TTS - Real-time text-to-speech for AI coding assistants

Usage: agent-tts [options]

Options:
  --server    Run only the backend server
  --client    Run only the frontend development server
  --help, -h  Show this help message

Examples:
  agent-tts              Run both server and client (production mode)
  agent-tts --server     Run only the backend server
  agent-tts --client     Run only the frontend dev server
  agent-tts --server --client    Run both (same as no flags)

Environment Variables:
  PORT        Server port (default: 3456)
  CLIENT_PORT Client dev server port (default: 5173)
  HOST        Server host (default: localhost)
  NODE_ENV    Environment (development/production)
`);
  process.exit(0);
}

// Set environment flags
if (flags.server) {
  process.env.RUN_SERVER = 'true';
}
if (flags.client) {
  process.env.RUN_CLIENT = 'true';
}

// Import and run the appropriate service(s)
import('../dist/server/server/main.js');