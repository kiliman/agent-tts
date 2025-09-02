import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { FileState, TTSQueueEntry } from '../types/config.js';
import { TTSLogRepository } from '../database/tts-log.js';

export class DatabaseManager {
  private db: Database.Database;
  private dbPath: string;
  private ttsLogRepo: TTSLogRepository;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(os.homedir(), '.agent-tts', 'agent-tts.db');
    
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.ttsLogRepo = new TTSLogRepository();
    this.initialize();
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
        state TEXT CHECK(state IN ('queued', 'playing', 'played', 'error')) NOT NULL,
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
        state, api_response_status, api_response_message, processing_time, cwd
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      entry.cwd || null
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
      cwd: row.cwd
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
      isFavorite: row.is_favorite === 1
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