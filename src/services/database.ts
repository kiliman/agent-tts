import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import os from 'os';
import { FileState, TTSQueueEntry } from '../types/config';

export class DatabaseManager {
  private db: Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(os.homedir(), '.agent-tts', 'agent-tts.db');
    
    const dbDir = path.dirname(this.dbPath);
    const fs = require('fs');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.initialize();
  }

  private async initialize(): Promise<void> {
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });
    await this.initializeTables();
  }

  private async initializeTables(): Promise<void> {
    if (!this.db) return;
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_states (
        filepath TEXT PRIMARY KEY,
        last_modified INTEGER NOT NULL,
        file_size INTEGER NOT NULL,
        last_processed_offset INTEGER NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch())
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
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_tts_queue_state ON tts_queue(state);
      CREATE INDEX IF NOT EXISTS idx_tts_queue_timestamp ON tts_queue(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_tts_queue_profile ON tts_queue(profile);
    `);
  }

  async getFileState(filepath: string): Promise<FileState | null> {
    if (!this.db) return null;
    
    const row = await this.db.get(
      `SELECT filepath, last_modified, file_size, last_processed_offset
       FROM file_states
       WHERE filepath = ?`,
      filepath
    );
    
    if (!row) return null;
    
    return {
      filepath: row.filepath,
      lastModified: row.last_modified,
      fileSize: row.file_size,
      lastProcessedOffset: row.last_processed_offset
    };
  }

  async updateFileState(state: FileState): Promise<void> {
    if (!this.db) return;
    
    await this.db.run(
      `INSERT OR REPLACE INTO file_states (filepath, last_modified, file_size, last_processed_offset, updated_at)
       VALUES (?, ?, ?, ?, unixepoch())`,
      state.filepath,
      state.lastModified,
      state.fileSize,
      state.lastProcessedOffset
    );
  }

  async addTTSQueueEntry(entry: Omit<TTSQueueEntry, 'id'>): Promise<number> {
    if (!this.db) return 0;
    
    const result = await this.db.run(
      `INSERT INTO tts_queue (
        timestamp, filename, profile, original_text, filtered_text,
        state, api_response_status, api_response_message, processing_time
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      entry.timestamp.getTime(),
      entry.filename,
      entry.profile,
      entry.originalText,
      entry.filteredText,
      entry.state,
      entry.apiResponseStatus || null,
      entry.apiResponseMessage || null,
      entry.processingTime || null
    );
    
    return result.lastID || 0;
  }

  async getEntryById(id: number): Promise<TTSQueueEntry | null> {
    if (!this.db) return null;
    
    const row = await this.db.get(
      `SELECT * FROM tts_queue WHERE id = ?`,
      id
    );
    
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
      processingTime: row.processing_time
    };
  }

  async resetStuckPlayingEntries(): Promise<void> {
    if (!this.db) return;
    
    // Reset any other entries that might be stuck in 'playing' state
    await this.db.run(
      `UPDATE tts_queue 
       SET state = 'error', 
           api_response_message = 'Interrupted - new message started playing'
       WHERE state = 'playing'`
    );
  }
  
  async updateTTSQueueEntry(id: number, updates: Partial<TTSQueueEntry>): Promise<void> {
    if (!this.db) return;
    
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
    
    await this.db.run(
      `UPDATE tts_queue
       SET ${updateFields.join(', ')}
       WHERE id = ?`,
      ...values
    );
  }

  async getQueuedEntries(): Promise<TTSQueueEntry[]> {
    if (!this.db) return [];
    
    const rows = await this.db.all(
      `SELECT * FROM tts_queue
       WHERE state = 'queued'
       ORDER BY timestamp ASC`
    );
    
    return rows.map(this.mapRowToTTSEntry);
  }

  async getRecentEntries(limit: number = 50): Promise<TTSQueueEntry[]> {
    if (!this.db) return [];
    
    const rows = await this.db.all(
      `SELECT * FROM tts_queue
       ORDER BY timestamp DESC
       LIMIT ?`,
      limit
    );
    
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
      processingTime: row.processing_time
    };
  }

  async clearOldEntries(daysToKeep: number = 7): Promise<number> {
    if (!this.db) return 0;
    
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    const result = await this.db.run(
      `DELETE FROM tts_queue
       WHERE timestamp < ?`,
      cutoffTime
    );
    
    return result.changes || 0;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
    }
  }

  async waitForInit(): Promise<void> {
    while (!this.db) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}