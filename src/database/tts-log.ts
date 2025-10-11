import { getDatabase } from './schema.js'
import { TTSLogEntry } from '../shared/types.js'
import Database from 'better-sqlite3'

export interface TTSLogRecord extends TTSLogEntry {
  id?: number
  createdAt?: number
}

export class TTSLogRepository {
  private db: Database.Database

  constructor() {
    this.db = getDatabase()
  }

  addEntry(entry: TTSLogEntry): number {
    const result = this.db
      .prepare(
        `
      INSERT INTO tts_queue (
        timestamp, filename, profile, original_text, filtered_text,
        state, api_response_status, api_response_message, processing_time, cwd, role, images
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        entry.timestamp,
        entry.filePath,
        entry.profile,
        entry.originalText,
        entry.filteredText,
        entry.status,
        entry.ttsStatus,
        entry.ttsMessage,
        entry.elapsed,
        entry.cwd || null,
        entry.role || null,
        entry.images || null,
      )

    return result.lastInsertRowid as number
  }

  updateStatus(id: number, status: 'queued' | 'played' | 'error', ttsStatus?: number, ttsMessage?: string): void {
    this.db
      .prepare(
        `
      UPDATE tts_queue
      SET state = ?, api_response_status = ?, api_response_message = ?
      WHERE id = ?
    `,
      )
      .run(status, ttsStatus || null, ttsMessage || null, id)
  }

  getRecentEntries(limit: number = 50, offset: number = 0): TTSLogRecord[] {
    const rows = this.db
      .prepare(
        `
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
        is_favorite as isFavorite,
        cwd,
        role,
        created_at as createdAt,
        images
      FROM tts_queue
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `,
      )
      .all(limit, offset) as any[]

    return rows
  }

  getEntriesByProfile(profile: string, limit: number = 50, offset: number = 0, cwd?: string): TTSLogRecord[] {
    let query = `
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
        is_favorite as isFavorite,
        cwd,
        role,
        created_at as createdAt,
        images
      FROM tts_queue
      WHERE profile = ?
    `

    const params: any[] = [profile]

    if (cwd) {
      query += ` AND cwd = ?`
      params.push(cwd)
    }

    query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const rows = this.db.prepare(query).all(...params) as any[]

    return rows
  }

  getLogById(id: number): TTSLogRecord | null {
    const row = this.db
      .prepare(
        `
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
        is_favorite as isFavorite,
        cwd,
        role,
        created_at as createdAt,
        images
      FROM tts_queue
      WHERE id = ?
    `,
      )
      .get(id) as any

    return row || null
  }

  getRecentLogs(limit: number = 50, offset: number = 0): TTSLogRecord[] {
    return this.getRecentEntries(limit, offset)
  }

  getLogsByProfile(profile: string, limit: number = 50, offset: number = 0, cwd?: string): TTSLogRecord[] {
    return this.getEntriesByProfile(profile, limit, offset, cwd)
  }

  getFavoritesByProfile(profile: string, limit: number = 50, offset: number = 0, cwd?: string): TTSLogRecord[] {
    let query = `
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
        is_favorite as isFavorite,
        cwd,
        role,
        created_at as createdAt,
        images
      FROM tts_queue
      WHERE profile = ? AND is_favorite = 1
    `

    const params: any[] = [profile]

    if (cwd) {
      query += ` AND cwd = ?`
      params.push(cwd)
    }

    query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const rows = this.db.prepare(query).all(...params) as any[]

    return rows
  }

  getAllFavorites(limit: number = 50, offset: number = 0): TTSLogRecord[] {
    const rows = this.db
      .prepare(
        `
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
        is_favorite as isFavorite,
        cwd,
        role,
        created_at as createdAt,
        images
      FROM tts_queue
      WHERE is_favorite = 1
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `,
      )
      .all(limit, offset) as any[]

    return rows
  }

  getEntriesByStatus(status: 'queued' | 'played' | 'error', limit: number = 50): TTSLogRecord[] {
    const rows = this.db
      .prepare(
        `
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
        is_favorite as isFavorite,
        cwd,
        role,
        created_at as createdAt,
        images
      FROM tts_queue
      WHERE state = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `,
      )
      .all(status, limit) as any[]

    return rows
  }

  clearOldEntries(daysToKeep: number = 30): number {
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000

    const result = this.db
      .prepare(
        `
      DELETE FROM tts_queue
      WHERE timestamp < ?
    `,
      )
      .run(cutoffTime)

    return result.changes
  }

  getUniqueCwdsByProfile(profile: string): string[] {
    const rows = this.db
      .prepare(
        `
      SELECT DISTINCT cwd
      FROM tts_queue
      WHERE profile = ? AND cwd IS NOT NULL
      ORDER BY cwd
    `,
      )
      .all(profile) as { cwd: string }[]

    return rows.map((row) => row.cwd)
  }
}
