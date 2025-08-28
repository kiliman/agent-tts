import { getDatabase } from './schema';

export class SettingsRepository {
  getSetting(key: string): string | null {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value || null;
  }

  setSetting(key: string, value: string): void {
    const db = getDatabase();
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).run(key, value, now);
  }

  deleteSetting(key: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM app_settings WHERE key = ?').run(key);
  }

  getAllSettings(): Record<string, string> {
    const db = getDatabase();
    const rows = db.prepare('SELECT key, value FROM app_settings').all() as Array<{ key: string; value: string }>;
    
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    
    return settings;
  }

  // Profile-specific settings helpers
  getProfileEnabled(profileName: string): boolean {
    const value = this.getSetting(`profile.${profileName}.enabled`);
    return value === null ? true : value === 'true';
  }

  setProfileEnabled(profileName: string, enabled: boolean): void {
    this.setSetting(`profile.${profileName}.enabled`, enabled.toString());
  }

  getMuteAll(): boolean {
    const value = this.getSetting('mute_all');
    return value === 'true';
  }

  setMuteAll(muted: boolean): void {
    this.setSetting('mute_all', muted.toString());
  }

  getGlobalHotkey(): string {
    return this.getSetting('global_hotkey') || 'Control+Escape';
  }

  setGlobalHotkey(hotkey: string): void {
    this.setSetting('global_hotkey', hotkey);
  }
}