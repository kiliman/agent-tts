import Database from 'better-sqlite3'
import { AGENT_TTS_PATHS } from '../utils/xdg-paths.js'
import { join } from 'path'
import { existsSync } from 'fs'

interface LogEntry {
  id: number
  timestamp: number
  filename: string
  profile: string
  original_text: string
  filtered_text: string
  state: string
  cwd: string | null
  role: 'user' | 'assistant' | null
}

interface CLIOptions {
  last?: number
  since?: string
  cwd?: string
  excludeCwd?: string
  profile?: string
  json?: boolean
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2)
  const options: CLIOptions = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case '--last':
        options.last = parseInt(args[++i], 10)
        break
      case '--since':
        options.since = args[++i]
        break
      case '--cwd':
        options.cwd = args[++i]
        break
      case '--exclude-cwd':
        options.excludeCwd = args[++i]
        break
      case '--profile':
        options.profile = args[++i]
        break
      case '--json':
        options.json = true
        break
    }
  }

  return options
}

function parseDateToTimestamp(dateStr: string): number {
  // Handle relative time expressions
  const relativeTimeMatch = dateStr.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i)
  if (relativeTimeMatch) {
    const amount = parseInt(relativeTimeMatch[1], 10)
    const unit = relativeTimeMatch[2].toLowerCase()

    const now = Date.now()
    const multipliers: Record<string, number> = {
      second: 1000,
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    }

    return now - amount * multipliers[unit]
  }

  // Try parsing as a date string
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    console.error(`Invalid date format: ${dateStr}`)
    process.exit(1)
  }

  return date.getTime()
}

function resolveCwd(cwdArg: string): string {
  if (cwdArg === '.') {
    return process.cwd()
  }
  return cwdArg
}

function queryLogs(options: CLIOptions): LogEntry[] {
  const dbPath = join(AGENT_TTS_PATHS.state, 'agent-tts.db')

  if (!existsSync(dbPath)) {
    console.error(`Database not found at: ${dbPath}`)
    process.exit(1)
  }

  const db = new Database(dbPath, { readonly: true })

  let query = 'SELECT * FROM tts_queue WHERE 1=1'
  const params: any[] = []

  // Add timestamp filter
  if (options.since) {
    const timestamp = parseDateToTimestamp(options.since)
    query += ' AND timestamp >= ?'
    params.push(timestamp)
  }

  // Add cwd filter
  if (options.cwd) {
    const cwd = resolveCwd(options.cwd)
    query += ' AND cwd = ?'
    params.push(cwd)
  }

  // Add exclude-cwd filter
  if (options.excludeCwd) {
    const excludeCwd = resolveCwd(options.excludeCwd)
    query += ' AND (cwd IS NULL OR cwd != ?)'
    params.push(excludeCwd)
  }

  // Add profile filter
  if (options.profile) {
    query += ' AND profile = ?'
    params.push(options.profile)
  }

  // Order by timestamp
  query += ' ORDER BY timestamp DESC'

  // Add limit
  const limit = options.last || 20
  query += ' LIMIT ?'
  params.push(limit)

  const logs = db.prepare(query).all(...params) as LogEntry[]

  db.close()

  // Reverse to show oldest first
  return logs.reverse()
}

function formatAsMarkdown(logs: LogEntry[]): string {
  let output = '# Agent TTS Conversation Log\n\n'

  for (const log of logs) {
    const date = new Date(log.timestamp)
    const timeStr = date.toLocaleString()
    const role = log.role || 'unknown'
    const roleLabel = role === 'user' ? '**User**' : '**Assistant**'

    output += `## ${roleLabel} - ${timeStr}\n\n`

    if (log.cwd) {
      output += `_Working Directory: ${log.cwd}_\n\n`
    }

    output += `${log.original_text}\n\n`
    output += '---\n\n'
  }

  return output
}

function formatAsJson(logs: LogEntry[]): string {
  return JSON.stringify(logs, null, 2)
}

function main() {
  const options = parseArgs()

  try {
    const logs = queryLogs(options)

    if (logs.length === 0) {
      console.log('No logs found matching the criteria')
      return
    }

    const output = options.json ? formatAsJson(logs) : formatAsMarkdown(logs)
    console.log(output)
  } catch (error) {
    console.error('Error querying logs:', error)
    process.exit(1)
  }
}

main()
