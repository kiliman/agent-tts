import { getDatabase } from './schema';

export class SettingsRepository {
  async getSetting(key: string): Promise<string | null> {
    const db = getDatabase();
    const row = await db.get<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', key);
    return row?.value || null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const db = getDatabase();
    const now = Date.now();
    
    await db.run(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `, key, value, now);
  }

  async deleteSetting(key: string): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM app_settings WHERE key = ?', key);
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const db = getDatabase();
    const rows = await db.all<{ key: string; value: string }[]>('SELECT key, value FROM app_settings');
    
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    
    return settings;
  }

  // Profile-specific settings helpers
  async getProfileEnabled(profileName: string): Promise<boolean> {
    const value = await this.getSetting(`profile:${profileName}:enabled`);
    return value === null || value === 'true';
  }

  async setProfileEnabled(profileName: string, enabled: boolean): Promise<void> {
    await this.setSetting(`profile:${profileName}:enabled`, enabled.toString());
  }

  // Global mute setting
  async getMuteAll(): Promise<boolean> {
    const value = await this.getSetting('global:mute');
    return value === 'true';
  }

  async setMuteAll(muted: boolean): Promise<void> {
    await this.setSetting('global:mute', muted.toString());
  }

  // Global hotkey setting
  async getGlobalHotkey(): Promise<string> {
    const value = await this.getSetting('global:hotkey');
    return value || 'Ctrl+Esc';
  }

  async setGlobalHotkey(hotkey: string): Promise<void> {
    await this.setSetting('global:hotkey', hotkey);
  }
}