import { getDatabase } from './schema';

export interface FileState {
  filePath: string;
  profile: string;
  lastModified: number;
  fileSize: number;
  createdAt: number;
  updatedAt: number;
}

export class FileStateRepository {
  async getFileState(filePath: string): Promise<FileState | null> {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT 
        file_path as filePath,
        profile,
        last_modified as lastModified,
        file_size as fileSize,
        created_at as createdAt,
        updated_at as updatedAt
      FROM file_states
      WHERE file_path = ?
    `);
    
    const row = stmt.get(filePath) as FileState | undefined;
    return row || null;
  }

  async upsertFileState(state: Omit<FileState, 'createdAt' | 'updatedAt'>): Promise<void> {
    const db = getDatabase();
    const now = Date.now();
    
    const stmt = db.prepare(`
      INSERT INTO file_states (file_path, profile, last_modified, file_size, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(file_path) DO UPDATE SET
        profile = excluded.profile,
        last_modified = excluded.last_modified,
        file_size = excluded.file_size,
        updated_at = excluded.updated_at
    `);
    
    stmt.run(
      state.filePath,
      state.profile,
      state.lastModified,
      state.fileSize,
      now,
      now
    );
  }

  async deleteFileState(filePath: string): Promise<void> {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM file_states WHERE file_path = ?');
    stmt.run(filePath);
  }

  async getFileStatesByProfile(profile: string): Promise<FileState[]> {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT 
        file_path as filePath,
        profile,
        last_modified as lastModified,
        file_size as fileSize,
        created_at as createdAt,
        updated_at as updatedAt
      FROM file_states
      WHERE profile = ?
      ORDER BY updated_at DESC
    `);
    
    const rows = stmt.all(profile) as FileState[];
    return rows;
  }

  async deleteFileStatesByProfile(profile: string): Promise<void> {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM file_states WHERE profile = ?');
    stmt.run(profile);
  }
}