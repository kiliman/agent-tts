#!/usr/bin/env node

// Parse CLI arguments
const args = process.argv.slice(2)

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Agent TTS Logs - Query conversation logs from agent-tts database

Usage: agent-tts-logs [options]

Options:
  --last N          Get last N messages (default: 20)
  --since DATE      Get messages since date/time (local time)
                    Examples: "2025-10-08", "2025-10-08 14:30", "1 hour ago"
  --cwd PATH        Filter by working directory (use . for current directory)
  --exclude-cwd PATH  Exclude messages from working directory
  --profile NAME    Filter by profile name (e.g., claudia, opencode)
  --json            Output as JSON (default: Markdown)
  --help, -h        Show this help message

Examples:
  agent-tts-logs --last 50
  agent-tts-logs --since "2025-10-08 10:00"
  agent-tts-logs --cwd .
  agent-tts-logs --profile claudia
  agent-tts-logs --exclude-cwd /Users/michael/.config/agent-tts/sweet-messages
  agent-tts-logs --cwd /Users/michael/Projects/myproject
  agent-tts-logs --last 100 --cwd . --json
`)
  process.exit(0)
}

// Start the CLI
import('../dist/server/cli/logs.js')
