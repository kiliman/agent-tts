import { getDatabase } from './schema';
import { TTSLogEntry } from '../shared/types';

export interface TTSLogRecord extends TTSLogEntry {
  id?: number;
  createdAt?: number;
}

export class TTSLogRepository {
  async addEntry(entry: TTSLogEntry): Promise<number> {
    const db = getDatabase();
    const result = await db.run(`
      INSERT INTO tts_log (
        timestamp, file_path, profile, original_text, filtered_text,
        status, tts_status, tts_message, elapsed_ms
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
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
    
    return result.lastID || 0;
  }

  async updateStatus(id: number, status: 'queued' | 'played' | 'error', ttsStatus?: number, ttsMessage?: string): Promise<void> {
    const db = getDatabase();
    await db.run(`
      UPDATE tts_log
      SET status = ?, tts_status = ?, tts_message = ?
      WHERE id = ?
    `, status, ttsStatus || null, ttsMessage || null, id);
  }

  async getRecentEntries(limit: number = 50): Promise<TTSLogRecord[]> {
    const db = getDatabase();
    const rows = await db.all<TTSLogRecord[]>(`
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
    `, limit);
    
    return rows;
  }

  async getEntriesByProfile(profile: string, limit: number = 50): Promise<TTSLogRecord[]> {
    const db = getDatabase();
    const rows = await db.all<TTSLogRecord[]>(`
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
    `, profile, limit);
    
    return rows;
  }

  async getEntriesByStatus(status: 'queued' | 'played' | 'error', limit: number = 50): Promise<TTSLogRecord[]> {
    const db = getDatabase();
    const rows = await db.all<TTSLogRecord[]>(`
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
      WHERE status = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `, status, limit);
    
    return rows;
  }

  async getQueuedCount(): Promise<number> {
    const db = getDatabase();
    const result = await db.get<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM tts_log
      WHERE status = 'queued'
    `);
    
    return result?.count || 0;
  }

  async clearOldEntries(daysToKeep: number = 7): Promise<void> {
    const db = getDatabase();
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    await db.run(`
      DELETE FROM tts_log
      WHERE timestamp < ?
    `, cutoffTime);
  }
}