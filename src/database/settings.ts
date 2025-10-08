import { getDatabase } from './schema.js'
import Database from 'better-sqlite3'

export class SettingsRepository {
  private db: Database.Database

  constructor() {
    this.db = getDatabase()
  }

  getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as any
    return row?.value || null
  }

  setSetting(key: string, value: string): void {
    const now = Date.now()

    this.db
      .prepare(
        `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `,
      )
      .run(key, value, now)
  }

  deleteSetting(key: string): void {
    this.db.prepare('DELETE FROM app_settings WHERE key = ?').run(key)
  }

  getAllSettings(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM app_settings').all() as any[]

    const settings: Record<string, string> = {}
    for (const row of rows) {
      settings[row.key] = row.value
    }

    return settings
  }

  // Profile-specific settings helpers
  getProfileEnabled(profileName: string): boolean {
    const value = this.getSetting(`profile:${profileName}:enabled`)
    return value === null || value === 'true'
  }

  setProfileEnabled(profileName: string, enabled: boolean): void {
    this.setSetting(`profile:${profileName}:enabled`, enabled.toString())
  }

  // Global mute setting
  getMuteAll(): boolean {
    const value = this.getSetting('global:mute')
    return value === 'true'
  }

  setMuteAll(muted: boolean): void {
    this.setSetting('global:mute', muted.toString())
  }
}
