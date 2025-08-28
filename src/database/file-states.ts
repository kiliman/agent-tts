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
  getFileState(filePath: string): FileState | null {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT 
        file_path as filePath,
        profile,
        last_modified as lastModified,
        file_size as fileSize,
        created_at as createdAt,
        updated_at as updatedAt
      FROM file_states
      WHERE file_path = ?
    `).get(filePath) as FileState | undefined;
    
    return row || null;
  }

  upsertFileState(state: Omit<FileState, 'createdAt' | 'updatedAt'>): void {
    const db = getDatabase();
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO file_states (file_path, profile, last_modified, file_size, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(file_path) DO UPDATE SET
        profile = excluded.profile,
        last_modified = excluded.last_modified,
        file_size = excluded.file_size,
        updated_at = excluded.updated_at
    `).run(
      state.filePath,
      state.profile,
      state.lastModified,
      state.fileSize,
      now,
      now
    );
  }

  deleteFileState(filePath: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM file_states WHERE file_path = ?').run(filePath);
  }

  getFileStatesByProfile(profile: string): FileState[] {
    const db = getDatabase();
    const rows = db.prepare(`
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
    `).all(profile) as FileState[];
    
    return rows;
  }

  deleteFileStatesByProfile(profile: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM file_states WHERE profile = ?').run(profile);
  }
}