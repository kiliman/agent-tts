import { getDatabase } from './schema';
import { TTSLogEntry } from '../shared/types';

export interface TTSLogRecord extends TTSLogEntry {
  id?: number;
  createdAt?: number;
}

export class TTSLogRepository {
  addEntry(entry: TTSLogEntry): number {
    const db = getDatabase();
    const result = db.prepare(`
      INSERT INTO tts_log (
        timestamp, file_path, profile, original_text, filtered_text,
        status, tts_status, tts_message, elapsed_ms
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.timestamp,
      entry.filePath,
      entry.profile,
      entry.originalText,
      entry.filteredText,
      entry.status,
      entry.ttsStatus,
      entry.ttsMessage,
      entry.elapsed
    );
    
    return result.lastInsertRowid as number;
  }

  updateStatus(id: number, status: 'queued' | 'played' | 'error', ttsStatus?: number, ttsMessage?: string): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE tts_log
      SET status = ?, tts_status = ?, tts_message = ?
      WHERE id = ?
    `).run(status, ttsStatus || null, ttsMessage || null, id);
  }

  getRecentEntries(limit: number = 50): TTSLogRecord[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT 
        id,
        timestamp,
        file_path as filePath,
        profile,
        original_text as originalText,
        filtered_text as filteredText,
        status,
        tts_status as ttsStatus,
        tts_message as ttsMessage,
        elapsed_ms as elapsed,
        created_at as createdAt
      FROM tts_log
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as TTSLogRecord[];
    
    return rows;
  }

  getEntriesByProfile(profile: string, limit: number = 50): TTSLogRecord[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT 
        id,
        timestamp,
        file_path as filePath,
        profile,
        original_text as originalText,
        filtered_text as filteredText,
        status,
        tts_status as ttsStatus,
        tts_message as ttsMessage,
        elapsed_ms as elapsed,
        created_at as createdAt
      FROM tts_log
      WHERE profile = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(profile, limit) as TTSLogRecord[];
    
    return rows;
  }

  getQueuedEntries(): TTSLogRecord[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT 
        id,
        timestamp,
        file_path as filePath,
        profile,
        original_text as originalText,
        filtered_text as filteredText,
        status,
        tts_status as ttsStatus,
        tts_message as ttsMessage,
        elapsed_ms as elapsed,
        created_at as createdAt
      FROM tts_log
      WHERE status = 'queued'
      ORDER BY timestamp ASC
    `).all() as TTSLogRecord[];
    
    return rows;
  }

  getErrorCount(since?: number): number {
    const db = getDatabase();
    let query = 'SELECT COUNT(*) as count FROM tts_log WHERE status = "error"';
    const params: any[] = [];
    
    if (since) {
      query += ' AND timestamp > ?';
      params.push(since);
    }
    
    const result = db.prepare(query).get(...params) as { count: number };
    return result.count;
  }

  clearOldEntries(beforeTimestamp: number): number {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM tts_log WHERE timestamp < ?').run(beforeTimestamp);
    return result.changes;
  }
}