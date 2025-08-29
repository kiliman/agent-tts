import { Database } from 'sqlite3';
import { open, Database as SqliteDatabase } from 'sqlite';
import path from 'path';
import fs from 'fs';
import os from 'os';

let db: SqliteDatabase | null = null;

export async function initializeDatabase(): Promise<SqliteDatabase> {
  // Use ~/.agent-tts directory for consistency
  const userDataPath = path.join(os.homedir(), '.agent-tts');
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
  
  // Clean up any stuck 'playing' entries from previous sessions
  await cleanupStuckEntries();
  
  return db;
}

async function createTables() {
  if (!db) throw new Error('Database not initialized');

  // File states table - track last processed position for each file
  await db.exec(`
    CREATE TABLE IF NOT EXISTS file_states (
      filepath TEXT PRIMARY KEY,
      last_modified INTEGER NOT NULL,
      file_size INTEGER NOT NULL,
      last_processed_offset INTEGER NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    );
  `);

  // TTS queue table - log all TTS operations (matching existing schema)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tts_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      filename TEXT NOT NULL,
      profile TEXT NOT NULL,
      original_text TEXT NOT NULL,
      filtered_text TEXT NOT NULL,
      content_hash TEXT,
      state TEXT CHECK(state IN ('queued', 'playing', 'played', 'error')) NOT NULL,
      api_response_status INTEGER,
      api_response_message TEXT,
      processing_time INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(profile, content_hash)
    );
    
    CREATE INDEX IF NOT EXISTS idx_tts_queue_state ON tts_queue(state);
    CREATE INDEX IF NOT EXISTS idx_tts_queue_timestamp ON tts_queue(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_tts_queue_profile ON tts_queue(profile);
    CREATE INDEX IF NOT EXISTS idx_tts_queue_content_hash ON tts_queue(content_hash);
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
      UPDATE file_states SET updated_at = unixepoch() WHERE filepath = NEW.filepath;
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
  
  // Check if we need to migrate the tts_queue table (after tables are created)
  await migrateTTSQueueTable();
}

export function getDatabase(): SqliteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

async function cleanupStuckEntries() {
  if (!db) return;
  
  // Reset any entries that were stuck in 'playing' state from previous session
  const result = await db.run(`
    UPDATE tts_queue 
    SET state = 'error', 
        api_response_message = 'Interrupted - app restarted'
    WHERE state = 'playing'
  `);
  
  if (result.changes && result.changes > 0) {
    console.log(`[Database] Reset ${result.changes} stuck 'playing' entries to 'error' state`);
  }
}

async function migrateTTSQueueTable() {
  if (!db) return;
  
  // Check if content_hash column exists
  const columns = await db.all(`
    PRAGMA table_info(tts_queue);
  `);
  
  const hasContentHash = columns.some((col: any) => col.name === 'content_hash');
  
  if (!hasContentHash) {
    console.log('[Database] Migrating tts_queue table to add content_hash column...');
    
    // Add the content_hash column
    await db.exec(`
      ALTER TABLE tts_queue ADD COLUMN content_hash TEXT;
    `);
    
    // Create index on content_hash
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tts_queue_content_hash ON tts_queue(content_hash);
    `);
    
    // Note: We can't add the UNIQUE constraint to an existing table easily in SQLite
    // For new installations, the constraint will be there from the start
    // For existing installations, we'll handle duplicates in the application layer
    
    console.log('[Database] Migration complete');
  }
}

export async function closeDatabase() {
  if (db) {
    await db.close();
    db = null;
  }
}