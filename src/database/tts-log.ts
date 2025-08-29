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
      INSERT INTO tts_queue (
        timestamp, filename, profile, original_text, filtered_text,
        state, api_response_status, api_response_message, processing_time
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
      UPDATE tts_queue
      SET state = ?, api_response_status = ?, api_response_message = ?
      WHERE id = ?
    `, status, ttsStatus || null, ttsMessage || null, id);
  }

  async getRecentEntries(limit: number = 50): Promise<TTSLogRecord[]> {
    const db = getDatabase();
    const rows = await db.all<TTSLogRecord[]>(`
      SELECT 
        id,
        timestamp,
        filename as filePath,
        profile,
        original_text as originalText,
        filtered_text as filteredText,
        state as status,
        api_response_status as ttsStatus,
        api_response_message as ttsMessage,
        processing_time as elapsed,
        created_at as createdAt
      FROM tts_queue
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
        filename as filePath,
        profile,
        original_text as originalText,
        filtered_text as filteredText,
        state as status,
        api_response_status as ttsStatus,
        api_response_message as ttsMessage,
        processing_time as elapsed,
        created_at as createdAt
      FROM tts_queue
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
        filename as filePath,
        profile,
        original_text as originalText,
        filtered_text as filteredText,
        state as status,
        api_response_status as ttsStatus,
        api_response_message as ttsMessage,
        processing_time as elapsed,
        created_at as createdAt
      FROM tts_queue
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
      FROM tts_queue
      WHERE state = 'queued'
    `);
    
    return result?.count || 0;
  }

  async clearOldEntries(daysToKeep: number = 7): Promise<void> {
    const db = getDatabase();
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    await db.run(`
      DELETE FROM tts_queue
      WHERE timestamp < ?
    `, cutoffTime);
  }
}