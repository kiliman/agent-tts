import { Database } from 'sqlite3';
import { open, Database as SqliteDatabase } from 'sqlite';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

let db: SqliteDatabase | null = null;

export async function initializeDatabase(): Promise<SqliteDatabase> {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'agent-tts.db');
  
  // Ensure directory exists
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  db = await open({
    filename: dbPath,
    driver: Database
  });
  
  // Enable foreign keys
  await db.exec('PRAGMA foreign_keys = ON;');
  
  // Create tables
  await createTables();
  
  return db;
}

async function createTables() {
  if (!db) throw new Error('Database not initialized');

  // File states table - track last processed position for each file
  await db.exec(`
    CREATE TABLE IF NOT EXISTS file_states (
      file_path TEXT PRIMARY KEY,
      profile TEXT NOT NULL,
      last_modified INTEGER NOT NULL,
      file_size INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    
    CREATE INDEX IF NOT EXISTS idx_file_states_profile ON file_states(profile);
  `);

  // TTS log table - log all TTS operations
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tts_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      profile TEXT NOT NULL,
      original_text TEXT NOT NULL,
      filtered_text TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('queued', 'played', 'error')),
      tts_status INTEGER,
      tts_message TEXT,
      elapsed_ms INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    
    CREATE INDEX IF NOT EXISTS idx_tts_log_timestamp ON tts_log(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_tts_log_profile ON tts_log(profile);
    CREATE INDEX IF NOT EXISTS idx_tts_log_status ON tts_log(status);
  `);

  // App settings table - store persistent settings
  await db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
  `);

  // Add trigger to update updated_at on file_states
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_file_states_timestamp
    AFTER UPDATE ON file_states
    BEGIN
      UPDATE file_states SET updated_at = (strftime('%s', 'now') * 1000) WHERE file_path = NEW.file_path;
    END;
  `);

  // Add trigger to update updated_at on app_settings
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_app_settings_timestamp
    AFTER UPDATE ON app_settings
    BEGIN
      UPDATE app_settings SET updated_at = (strftime('%s', 'now') * 1000) WHERE key = NEW.key;
    END;
  `);
}

export function getDatabase(): SqliteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export async function closeDatabase() {
  if (db) {
    await db.close();
    db = null;
  }
}