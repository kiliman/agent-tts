#!/usr/bin/env node

/**
 * Migration script to backfill cwd (current working directory) for existing tts_queue entries
 * 
 * This script reads the original log files and extracts the cwd field, then updates the database
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { AGENT_TTS_PATHS } from '../utils/xdg-paths.js';

const DB_PATH = path.join(AGENT_TTS_PATHS.state, 'agent-tts.db');

function migrateCwdField() {
  console.log('[Migration] Starting cwd backfill migration...');
  
  const db = new Database(DB_PATH);
  
  // Get all distinct filenames from the database
  const filenames = db.prepare(`
    SELECT DISTINCT filename 
    FROM tts_queue 
    WHERE cwd IS NULL
  `).all() as { filename: string }[];
  
  console.log(`[Migration] Found ${filenames.length} distinct files to process`);
  
  let updatedCount = 0;
  let processedFiles = 0;
  
  for (const { filename } of filenames) {
    processedFiles++;
    console.log(`[Migration] Processing ${processedFiles}/${filenames.length}: ${filename}`);
    
    let cwd: string | null = null;
    
    try {
      // Check if file exists
      if (!fs.existsSync(filename)) {
        console.log(`[Migration] File not found, skipping: ${filename}`);
        continue;
      }
      
      const content = fs.readFileSync(filename, 'utf-8');
      
      // Check if it's a Claude Code file (jsonl)
      if (filename.endsWith('.jsonl')) {
        // Parse JSONL and find first entry with cwd
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.cwd) {
              cwd = data.cwd;
              console.log(`[Migration] Found cwd for Claude Code: ${cwd}`);
              break;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
      // For OpenCode files, we need to read the related message file
      else if (filename.includes('opencode')) {
        try {
          const partMessage = JSON.parse(content);
          
          if (partMessage.sessionID && partMessage.messageID) {
            const messagePath = path.join(
              homedir(),
              '.local/share/opencode/project/global/storage/session/message',
              partMessage.sessionID,
              `${partMessage.messageID}.json`
            );
            
            if (fs.existsSync(messagePath)) {
              const messageContent = fs.readFileSync(messagePath, 'utf-8');
              const messageData = JSON.parse(messageContent);
              
              if (messageData.path?.cwd) {
                cwd = messageData.path.cwd;
                console.log(`[Migration] Found cwd for OpenCode: ${cwd}`);
              }
            }
          }
        } catch (error) {
          console.log(`[Migration] Error parsing OpenCode file: ${error}`);
        }
      }
      
      // Update all entries for this filename if we found a cwd
      if (cwd) {
        const result = db.prepare(`
          UPDATE tts_queue 
          SET cwd = ? 
          WHERE filename = ? AND cwd IS NULL
        `).run(cwd, filename);
        
        updatedCount += result.changes;
        console.log(`[Migration] Updated ${result.changes} entries for ${filename}`);
      } else {
        console.log(`[Migration] No cwd found for ${filename}`);
      }
      
    } catch (error) {
      console.error(`[Migration] Error processing ${filename}:`, error);
    }
  }
  
  db.close();
  
  console.log(`[Migration] Migration complete!`);
  console.log(`[Migration] Processed ${processedFiles} files`);
  console.log(`[Migration] Updated ${updatedCount} database entries`);
}

// Run the migration
try {
  migrateCwdField();
} catch (error) {
  console.error('[Migration] Fatal error:', error);
  process.exit(1);
}