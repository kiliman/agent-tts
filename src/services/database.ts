import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { FileState, TTSQueueEntry } from '../types/config.js';
import { TTSLogRepository } from '../database/tts-log.js';
import { AGENT_TTS_PATHS } from '../utils/xdg-paths.js';

export class DatabaseManager {
  private db: Database.Database;
  private dbPath: string;
  private ttsLogRepo: TTSLogRepository;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(AGENT_TTS_PATHS.state, 'agent-tts.db');
    
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Create backup if database exists
    if (fs.existsSync(this.dbPath)) {
      this.createBackup();
    }

    this.db = new Database(this.dbPath);
    this.ttsLogRepo = new TTSLogRepository();
    this.initialize();
  }
  
  private createBackup(): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupDir = path.join(path.dirname(this.dbPath), 'backups');
      
      // Create backup directory if it doesn't exist
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const backupPath = path.join(backupDir, `agent-tts-${timestamp}.db`);
      fs.copyFileSync(this.dbPath, backupPath);
      console.log(`[Database] Backup created: ${backupPath}`);
      
      // Clean up old backups (keep last 10)
      const backups = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('agent-tts-') && f.endsWith('.db'))
        .sort()
        .reverse();
      
      if (backups.length > 10) {
        for (const oldBackup of backups.slice(10)) {
          fs.unlinkSync(path.join(backupDir, oldBackup));
          console.log(`[Database] Removed old backup: ${oldBackup}`);
        }
      }
    } catch (err) {
      console.error('[Database] Failed to create backup:', err);
    }
  }
  
  getTTSLog(): TTSLogRepository {
    return this.ttsLogRepo;
  }

  private initialize(): void {
    this.initializeTables();
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_states (
        filepath TEXT PRIMARY KEY,
        last_modified INTEGER NOT NULL,
        file_size INTEGER NOT NULL,
        last_processed_offset INTEGER NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
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
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_tts_queue_state ON tts_queue(state);
      CREATE INDEX IF NOT EXISTS idx_tts_queue_timestamp ON tts_queue(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_tts_queue_profile ON tts_queue(profile);
    `);
    
    // Migration: Add is_favorite column if it doesn't exist
    const columns = this.db.prepare("PRAGMA table_info(tts_queue)").all() as any[];
    const hasFavoriteColumn = columns.some((col: any) => col.name === 'is_favorite');
    
    if (!hasFavoriteColumn) {
      this.db.exec(`
        ALTER TABLE tts_queue 
        ADD COLUMN is_favorite INTEGER DEFAULT 0;
        
        CREATE INDEX IF NOT EXISTS idx_tts_queue_favorites ON tts_queue(is_favorite, timestamp DESC);
      `);
      console.log('[Database] Added is_favorite column to tts_queue table');
    }
    
    // Migration: Add cwd column if it doesn't exist
    const hasCwdColumn = columns.some((col: any) => col.name === 'cwd');
    
    if (!hasCwdColumn) {
      this.db.exec(`
        ALTER TABLE tts_queue 
        ADD COLUMN cwd TEXT;
        
        CREATE INDEX IF NOT EXISTS idx_tts_queue_cwd ON tts_queue(cwd);
      `);
      console.log('[Database] Added cwd column to tts_queue table');
    }
    
    // Migration: Add role column if it doesn't exist
    const hasRoleColumn = columns.some((col: any) => col.name === 'role');
    
    if (!hasRoleColumn) {
      this.db.exec(`
        ALTER TABLE tts_queue 
        ADD COLUMN role TEXT CHECK(role IN ('user', 'assistant'));
        
        CREATE INDEX IF NOT EXISTS idx_tts_queue_role ON tts_queue(role);
      `);
      console.log('[Database] Added role column to tts_queue table');
    }
    
    // Migration: Update state constraint to include 'user'
    // Need to recreate the table to modify CHECK constraint
    try {
      // Check if we need to update the constraint
      const tableInfo = this.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tts_queue'").get() as any;
      if (tableInfo && tableInfo.sql) {
        const needsUpdate = !tableInfo.sql.includes("'user'") || 
                          tableInfo.sql.includes("CHECK(state IN ('queued', 'playing', 'played', 'error'))");
        
        if (needsUpdate) {
          console.log('[Database] Updating state constraint to include "user"...');
          console.log('[Database] Current table definition:', tableInfo.sql);
          
          // Start a transaction
          this.db.exec('BEGIN TRANSACTION');
          
          try {
            // Create a new table with the updated constraint
            this.db.exec(`
              CREATE TABLE tts_queue_new (
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
                role TEXT CHECK(role IN ('user', 'assistant'))
              );
            `);
            
            // Copy data from old table (only columns that exist)
            this.db.exec(`
              INSERT INTO tts_queue_new (
                id, timestamp, filename, profile, original_text, filtered_text, 
                state, api_response_status, api_response_message, processing_time, 
                created_at, is_favorite, cwd, role
              )
              SELECT 
                id, timestamp, filename, profile, original_text, filtered_text,
                state, api_response_status, api_response_message, processing_time,
                created_at, is_favorite, cwd, role
              FROM tts_queue
            `);
            
            // Drop old table
            this.db.exec('DROP TABLE tts_queue');
            
            // Rename new table
            this.db.exec('ALTER TABLE tts_queue_new RENAME TO tts_queue');
            
            // Recreate indexes
            this.db.exec(`
              CREATE INDEX IF NOT EXISTS idx_tts_queue_state ON tts_queue(state);
              CREATE INDEX IF NOT EXISTS idx_tts_queue_timestamp ON tts_queue(timestamp DESC);
              CREATE INDEX IF NOT EXISTS idx_tts_queue_profile ON tts_queue(profile);
              CREATE INDEX IF NOT EXISTS idx_tts_queue_favorites ON tts_queue(is_favorite, timestamp DESC);
              CREATE INDEX IF NOT EXISTS idx_tts_queue_cwd ON tts_queue(cwd);
              CREATE INDEX IF NOT EXISTS idx_tts_queue_role ON tts_queue(role);
            `);
            
            // Commit transaction
            this.db.exec('COMMIT');
            
            console.log('[Database] Successfully updated state constraint');
          } catch (error) {
            // Rollback on error
            this.db.exec('ROLLBACK');
            throw error;
          }
        }
      }
    } catch (err) {
      console.error('[Database] Error updating state constraint:', err);
    }
  }

  getFileState(filepath: string): FileState | null {
    const row = this.db.prepare(
      `SELECT filepath, last_modified, file_size, last_processed_offset
       FROM file_states
       WHERE filepath = ?`
    ).get(filepath) as any;
    
    if (!row) return null;
    
    return {
      filepath: row.filepath,
      lastModified: row.last_modified,
      fileSize: row.file_size,
      lastProcessedOffset: row.last_processed_offset
    };
  }

  updateFileState(state: FileState): void {
    this.db.prepare(
      `INSERT OR REPLACE INTO file_states (filepath, last_modified, file_size, last_processed_offset, updated_at)
       VALUES (?, ?, ?, ?, strftime('%s', 'now'))`
    ).run(
      state.filepath,
      state.lastModified,
      state.fileSize,
      state.lastProcessedOffset
    );
  }

  addTTSQueueEntry(entry: Omit<TTSQueueEntry, 'id'>): number {
    const result = this.db.prepare(
      `INSERT INTO tts_queue (
        timestamp, filename, profile, original_text, filtered_text,
        state, api_response_status, api_response_message, processing_time, cwd, role
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      entry.timestamp.getTime(),
      entry.filename,
      entry.profile,
      entry.originalText,
      entry.filteredText,
      entry.state,
      entry.apiResponseStatus || null,
      entry.apiResponseMessage || null,
      entry.processingTime || null,
      entry.cwd || null,
      entry.role || null
    );
    
    return result.lastInsertRowid as number;
  }

  getEntryById(id: number): TTSQueueEntry | null {
    const row = this.db.prepare(
      `SELECT * FROM tts_queue WHERE id = ?`
    ).get(id) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      filename: row.filename,
      profile: row.profile,
      originalText: row.original_text,
      filteredText: row.filtered_text,
      state: row.state,
      apiResponseStatus: row.api_response_status,
      apiResponseMessage: row.api_response_message,
      processingTime: row.processing_time,
      isFavorite: row.is_favorite,
      cwd: row.cwd,
      role: row.role
    };
  }

  resetStuckPlayingEntries(): void {
    // Reset any other entries that might be stuck in 'playing' state
    this.db.prepare(
      `UPDATE tts_queue 
       SET state = 'error', 
           api_response_message = 'Interrupted - new message started playing'
       WHERE state = 'playing'`
    ).run();
  }
  
  updateTTSQueueEntry(id: number, updates: Partial<TTSQueueEntry>): void {
    const updateFields: string[] = [];
    const values: any[] = [];
    
    if (updates.state !== undefined) {
      updateFields.push('state = ?');
      values.push(updates.state);
    }
    
    if (updates.apiResponseStatus !== undefined) {
      updateFields.push('api_response_status = ?');
      values.push(updates.apiResponseStatus);
    }
    
    if (updates.apiResponseMessage !== undefined) {
      updateFields.push('api_response_message = ?');
      values.push(updates.apiResponseMessage);
    }
    
    if (updates.processingTime !== undefined) {
      updateFields.push('processing_time = ?');
      values.push(updates.processingTime);
    }
    
    if (updateFields.length === 0) return;
    
    values.push(id);
    
    this.db.prepare(
      `UPDATE tts_queue
       SET ${updateFields.join(', ')}
       WHERE id = ?`
    ).run(...values);
  }

  getQueuedEntries(): TTSQueueEntry[] {
    const rows = this.db.prepare(
      `SELECT * FROM tts_queue
       WHERE state = 'queued'
       ORDER BY timestamp ASC`
    ).all() as any[];
    
    return rows.map(this.mapRowToTTSEntry);
  }

  getRecentEntries(limit: number = 50): TTSQueueEntry[] {
    const rows = this.db.prepare(
      `SELECT * FROM tts_queue
       ORDER BY timestamp DESC
       LIMIT ?`
    ).all(limit) as any[];
    
    return rows.map(this.mapRowToTTSEntry);
  }

  private mapRowToTTSEntry(row: any): TTSQueueEntry {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      filename: row.filename,
      profile: row.profile,
      originalText: row.original_text,
      filteredText: row.filtered_text,
      state: row.state,
      apiResponseStatus: row.api_response_status,
      apiResponseMessage: row.api_response_message,
      processingTime: row.processing_time,
      isFavorite: row.is_favorite === 1,
      cwd: row.cwd,
      role: row.role
    };
  }
  
  toggleFavorite(id: number): boolean {
    // Get current favorite status
    const current = this.db.prepare(
      'SELECT is_favorite FROM tts_queue WHERE id = ?'
    ).get(id) as any;
    
    if (!current) return false;
    
    const newValue = current.is_favorite === 1 ? 0 : 1;
    
    // Toggle the favorite status
    this.db.prepare(
      'UPDATE tts_queue SET is_favorite = ? WHERE id = ?'
    ).run(newValue, id);
    
    return newValue === 1;
  }
  
  getFavoritesCount(profile?: string): number {
    if (profile) {
      const result = this.db.prepare(
        'SELECT COUNT(*) as count FROM tts_queue WHERE profile = ? AND is_favorite = 1'
      ).get(profile) as any;
      return result?.count || 0;
    } else {
      const result = this.db.prepare(
        'SELECT COUNT(*) as count FROM tts_queue WHERE is_favorite = 1'
      ).get() as any;
      return result?.count || 0;
    }
  }

  clearOldEntries(daysToKeep: number = 7): number {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    const result = this.db.prepare(
      `DELETE FROM tts_queue
       WHERE timestamp < ?`
    ).run(cutoffTime);
    
    return result.changes;
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }

  waitForInit(): void {
    // No longer needed with sync API
  }
}