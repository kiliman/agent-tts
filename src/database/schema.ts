import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { AGENT_TTS_PATHS } from '../utils/xdg-paths.js';

let db: Database.Database | null = null;

export function initializeDatabase(): Database.Database {
  // Use XDG_STATE_HOME for database (state/logs)
  const userDataPath = AGENT_TTS_PATHS.state;
  const dbPath = path.join(userDataPath, 'agent-tts.db');

  // Ensure directory exists
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  db = new Database(dbPath);
  
  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON;');
  
  // Create tables
  createTables();
  
  // Clean up any stuck 'playing' entries from previous sessions
  resetStuckPlayingEntries();
  
  console.log(`Database initialized at: ${dbPath}`);
  return db;
}

function createTables(): void {
  if (!db) throw new Error('Database not initialized');
  
  // File states table - check if profile column exists first
  const fileStatesInfo = db.prepare(`PRAGMA table_info(file_states)`).all() as any[];
  const hasProfileColumn = fileStatesInfo.some((col: any) => col.name === 'profile');
  
  if (!hasProfileColumn && fileStatesInfo.length > 0) {
    // Table exists but doesn't have profile column, add it
    db.exec(`ALTER TABLE file_states ADD COLUMN profile TEXT DEFAULT 'default'`);
  }
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_states (
      filepath TEXT PRIMARY KEY,
      profile TEXT DEFAULT 'default',
      last_modified INTEGER NOT NULL,
      file_size INTEGER NOT NULL,
      last_processed_offset INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    );
    
    CREATE INDEX IF NOT EXISTS idx_file_states_profile ON file_states(profile);
  `);
  
  // TTS queue/log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tts_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      filename TEXT NOT NULL,
      profile TEXT NOT NULL,
      original_text TEXT NOT NULL,
      filtered_text TEXT NOT NULL,
      state TEXT CHECK(state IN ('queued', 'playing', 'played', 'error')) NOT NULL DEFAULT 'queued',
      api_response_status INTEGER,
      api_response_message TEXT,
      processing_time INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    );
    
    CREATE INDEX IF NOT EXISTS idx_tts_queue_state ON tts_queue(state);
    CREATE INDEX IF NOT EXISTS idx_tts_queue_timestamp ON tts_queue(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_tts_queue_profile ON tts_queue(profile);
  `);
  
  // App settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    );
  `);
}

function resetStuckPlayingEntries(): void {
  if (!db) return;
  
  // Reset any entries stuck in 'playing' state from previous sessions
  const stmt = db.prepare(`
    UPDATE tts_queue 
    SET state = 'error', 
        api_response_message = 'Interrupted - application restarted'
    WHERE state = 'playing'
  `);
  
  const result = stmt.run();
  if (result.changes > 0) {
    console.log(`Reset ${result.changes} stuck 'playing' entries`);
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}