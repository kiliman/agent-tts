#!/usr/bin/env tsx
import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { glob } from 'glob'
import { ClaudeCodeParser } from '../parsers/claude-code-parser.js'
import { OpenCodeParser } from '../parsers/opencode-parser.js'
import { FilterChain } from '../filters/filter-chain.js'
import { ParsedMessage, ProfileConfig } from '../types/config.js'
import { AGENT_TTS_PATHS } from '../utils/xdg-paths.js'

// Load configuration
async function loadConfig(): Promise<any> {
  const configPaths = [
    path.join(os.homedir(), '.config', 'agent-tts', 'config.js'),
    path.join(os.homedir(), '.config', 'agent-tts', 'config.ts'),
    path.join(os.homedir(), '.agent-tts', 'index.js'),
    path.join(os.homedir(), '.agent-tts', 'index.ts'),
  ]

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      const fileUrl = `file://${configPath}?t=${Date.now()}`
      const module = await import(fileUrl)
      return module.default || module
    }
  }

  throw new Error('No configuration file found')
}

// Expand tilde in paths
function expandPath(filepath: string): string {
  if (filepath.startsWith('~/')) {
    return path.join(os.homedir(), filepath.slice(2))
  }
  return filepath
}

// Main regeneration function
async function regenerateDatabase() {
  const args = process.argv.slice(2)
  const shouldSwap = args.includes('--swap')

  console.log('Loading configuration...')
  const config = await loadConfig()

  const dbPath = path.join(AGENT_TTS_PATHS.state, 'agent-tts-regen.db')
  console.log(`Creating new database at: ${dbPath}`)

  // Delete existing regen database if it exists
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath)
    console.log('Removed existing regeneration database')
  }

  // Create new database
  const db = new Database(dbPath)

  // Create tables
  console.log('Creating database schema...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS tts_queue_temp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      filename TEXT NOT NULL,
      profile TEXT NOT NULL,
      original_text TEXT NOT NULL,
      filtered_text TEXT NOT NULL,
      state TEXT CHECK(state IN ('queued', 'playing', 'played', 'error', 'user')) NOT NULL,
      api_response_status INTEGER,
      api_response_message TEXT,
      processing_time INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      is_favorite INTEGER DEFAULT 0,
      cwd TEXT,
      role TEXT CHECK(role IN ('user', 'assistant')),
      images TEXT
    );

    CREATE TABLE IF NOT EXISTS tts_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      filename TEXT NOT NULL,
      profile TEXT NOT NULL,
      original_text TEXT NOT NULL,
      filtered_text TEXT NOT NULL,
      state TEXT CHECK(state IN ('queued', 'playing', 'played', 'error', 'user')) NOT NULL,
      api_response_status INTEGER,
      api_response_message TEXT,
      processing_time INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      is_favorite INTEGER DEFAULT 0,
      cwd TEXT,
      role TEXT CHECK(role IN ('user', 'assistant')),
      images TEXT
    );
    
    CREATE TABLE IF NOT EXISTS file_states (
      filepath TEXT PRIMARY KEY,
      last_modified INTEGER NOT NULL,
      file_size INTEGER NOT NULL,
      last_processed_offset INTEGER NOT NULL,
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_tts_queue_state ON tts_queue(state);
    CREATE INDEX IF NOT EXISTS idx_tts_queue_timestamp ON tts_queue(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_tts_queue_profile ON tts_queue(profile);
    CREATE INDEX IF NOT EXISTS idx_tts_queue_favorites ON tts_queue(is_favorite, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_tts_queue_cwd ON tts_queue(cwd);
    CREATE INDEX IF NOT EXISTS idx_tts_queue_role ON tts_queue(role);
  `)

  // Process each profile
  for (const profile of config.profiles) {
    if (!profile.enabled && profile.enabled !== undefined) {
      console.log(`Skipping disabled profile: ${profile.id}`)
      continue
    }

    console.log(`\nProcessing profile: ${profile.id}`)
    console.log(`  Parser type: ${profile.parser.type}`)

    // Create parser
    let parser
    if (profile.parser.type === 'claude-code') {
      parser = new ClaudeCodeParser()
    } else if (profile.parser.type === 'opencode') {
      parser = new OpenCodeParser()
    } else {
      console.log(`  Unknown parser type: ${profile.parser.type}, skipping`)
      continue
    }

    // Create filter chain
    const filterChain = new FilterChain(profile.filters || [])

    // Process each watch path
    for (const watchPath of profile.watchPaths) {
      const expandedPath = expandPath(watchPath)
      console.log(`  Processing watch path: ${watchPath} -> ${expandedPath}`)

      // Find all matching files
      const files = await glob(expandedPath)
      console.log(`  Found ${files.length} files`)

      for (const filepath of files) {
        try {
          // Get file stats
          const stats = fs.statSync(filepath)
          const fileSize = stats.size
          const lastModified = stats.mtimeMs

          // Read file content
          const content = fs.readFileSync(filepath, 'utf-8')
          if (!content.trim()) continue

          // Parse messages (await since parse is now async for image extraction)
          const messages = await parser.parse(content, filepath)

          // Process each message
          for (const message of messages) {
            // Handle user messages
            if (message.role === 'user') {
              const stmt = db.prepare(`
                INSERT INTO tts_queue_temp (
                  timestamp, filename, profile, original_text, filtered_text,
                  state, cwd, role, images
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `)

              const imagesStr = message.images && message.images.length > 0 ? message.images.join(',') : null

              stmt.run(
                message.timestamp ? message.timestamp.getTime() : Date.now(),
                filepath,
                profile.id,
                message.content,
                message.content, // No filtering for user messages
                'user',
                message.cwd || null,
                'user',
                imagesStr,
              )
            } else {
              // Apply filters for assistant messages
              const filteredMessage = filterChain.apply(message)
              if (!filteredMessage || !filteredMessage.content.trim()) continue

              const stmt = db.prepare(`
                INSERT INTO tts_queue_temp (
                  timestamp, filename, profile, original_text, filtered_text,
                  state, cwd, role, images
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `)

              const imagesStr = message.images && message.images.length > 0 ? message.images.join(',') : null

              stmt.run(
                message.timestamp ? message.timestamp.getTime() : Date.now(),
                filepath,
                profile.id,
                message.content,
                filteredMessage.content,
                'played', // Mark all historical messages as played
                message.cwd || null,
                'assistant',
                imagesStr,
              )
            }
          }

          // Add file to file_states table so it won't be reprocessed on startup
          const fileStateStmt = db.prepare(`
            INSERT OR REPLACE INTO file_states (
              filepath, last_modified, file_size, last_processed_offset
            ) VALUES (?, ?, ?, ?)
          `)
          fileStateStmt.run(filepath, lastModified, fileSize, fileSize)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error(`  Error processing ${filepath}:`, message)
        }
      }
    }
  }

  // Get counts
  const tempCount = db.prepare('SELECT COUNT(*) as count FROM tts_queue_temp').get() as any
  console.log(`\nTotal messages in temp table: ${tempCount.count}`)

  // Count messages with images
  const imagesCount = db.prepare('SELECT COUNT(*) as count FROM tts_queue_temp WHERE images IS NOT NULL').get() as any
  console.log(`Messages with images: ${imagesCount.count}`)

  // Count tracked files
  const fileStatesCount = db.prepare('SELECT COUNT(*) as count FROM file_states').get() as any
  console.log(`Files tracked in file_states: ${fileStatesCount.count}`)

  // Copy from temp to final table, sorted by timestamp
  console.log('Copying sorted messages to final table...')
  db.exec(`
    INSERT INTO tts_queue (
      timestamp, filename, profile, original_text, filtered_text,
      state, api_response_status, api_response_message, processing_time,
      created_at, is_favorite, cwd, role, images
    )
    SELECT
      timestamp, filename, profile, original_text, filtered_text,
      state, api_response_status, api_response_message, processing_time,
      created_at, is_favorite, cwd, role, images
    FROM tts_queue_temp
    ORDER BY timestamp ASC
  `)

  // Verify final count
  const finalCount = db.prepare('SELECT COUNT(*) as count FROM tts_queue').get() as any
  console.log(`Total messages in final table: ${finalCount.count}`)

  // Drop temp table
  db.exec('DROP TABLE tts_queue_temp')

  // Close database
  db.close()

  console.log(`\nDatabase regeneration complete!`)
  console.log(`New database created at: ${dbPath}`)

  // Handle automatic swap if requested
  if (shouldSwap) {
    console.log(`\n--swap flag detected, performing automatic database swap...`)

    const currentDbPath = path.join(AGENT_TTS_PATHS.state, 'agent-tts.db')
    const backupDir = path.join(AGENT_TTS_PATHS.state, 'backups')

    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
      console.log(`Created backups directory: ${backupDir}`)
    }

    // Check if current database exists
    if (fs.existsSync(currentDbPath)) {
      // Create timestamped backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const backupPath = path.join(backupDir, `agent-tts-${timestamp}.db`)

      console.log(`Backing up current database to: ${backupPath}`)
      fs.copyFileSync(currentDbPath, backupPath)
      console.log(`Backup created successfully`)

      // Clean up old backups (keep last 10)
      const backups = fs
        .readdirSync(backupDir)
        .filter((f) => f.startsWith('agent-tts-') && f.endsWith('.db'))
        .sort()
        .reverse()

      if (backups.length > 10) {
        for (const oldBackup of backups.slice(10)) {
          fs.unlinkSync(path.join(backupDir, oldBackup))
          console.log(`Removed old backup: ${oldBackup}`)
        }
      }
    }

    // Replace with new database
    console.log(`Replacing current database with regenerated version...`)
    fs.copyFileSync(dbPath, currentDbPath)
    console.log(`Database replaced successfully!`)

    // Remove the regen temp file
    fs.unlinkSync(dbPath)
    console.log(`Cleaned up temporary regeneration database`)

    console.log(`\n✅ Database swap complete!`)
    console.log(`\nIMPORTANT: Restart the agent-tts service for changes to take effect.`)
  } else {
    console.log(`\nTo use this database:`)
    console.log(`1. Stop the agent-tts service`)
    console.log(`2. Run: agent-tts-regenerate-db --swap`)
    console.log(`   OR manually:`)
    console.log(`   - Backup: cp ${path.join(AGENT_TTS_PATHS.state, 'agent-tts.db')} ${path.join(AGENT_TTS_PATHS.state, 'backups', 'agent-tts.db.backup')}`)
    console.log(`   - Replace: cp ${dbPath} ${path.join(AGENT_TTS_PATHS.state, 'agent-tts.db')}`)
    console.log(`3. Restart the agent-tts service`)
  }
}

// Run the regeneration
regenerateDatabase().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
