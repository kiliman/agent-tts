#!/usr/bin/env node

const args = process.argv.slice(2)

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Agent TTS Database Regenerator - Rebuild database from chat logs

Usage: agent-tts-regenerate-db [options]

Options:
  --swap            Automatically backup and replace the current database
  --help, -h        Show this help message

Description:
  This tool rebuilds the agent-tts database by re-parsing all chat logs
  from your configured profiles. It extracts messages, images, and metadata.

  By default, it creates a new database file without replacing the current one.
  Use --swap to automatically backup the current database and replace it.

Examples:
  # Generate a new database for review
  agent-tts-regenerate-db

  # Generate and automatically swap databases
  agent-tts-regenerate-db --swap

Note: If using --swap, make sure the agent-tts service is stopped first!
`)
  process.exit(0)
}

// Start the regeneration
import('../dist/server/scripts/regenerate-db.js')
