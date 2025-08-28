import { EventEmitter } from 'events';
import { ProfileConfig, ParsedMessage, TTSQueueEntry } from '../types/config';
import { FileChange } from './file-monitor';
import { ParserFactory } from '../parsers/parser-factory';
import { FilterChain } from '../filters/filter-chain';
import { DatabaseManager } from './database';

export class MessageProcessor extends EventEmitter {
  private database: DatabaseManager;

  constructor(database: DatabaseManager) {
    super();
    this.database = database;
  }

  async processFileChange(change: FileChange): Promise<void> {
    const { profile, content, filepath } = change;

    if (!content.trim()) return;

    try {
      const parser = ParserFactory.createParser(profile.parser);
      const messages = parser.parse(content);

      if (messages.length === 0) return;

      const filterChain = new FilterChain(profile.filters || []);

      for (const message of messages) {
        const filteredMessage = filterChain.apply(message);
        
        if (!filteredMessage || !filteredMessage.content.trim()) {
          continue;
        }

        const entry: Omit<TTSQueueEntry, 'id'> = {
          timestamp: message.timestamp || new Date(),
          filename: filepath,
          profile: profile.id,
          originalText: message.content,
          filteredText: filteredMessage.content,
          state: 'queued'
        };

        const entryId = await this.database.addTTSQueueEntry(entry);
        
        this.emit('messageQueued', {
          ...entry,
          id: entryId,
          profileConfig: profile
        });
      }
    } catch (error) {
      console.error(`Error processing file change for ${filepath}:`, error);
      this.emit('processingError', {
        filepath,
        profile: profile.id,
        error
      });
    }
  }
}