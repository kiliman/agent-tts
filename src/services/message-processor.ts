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
    
    console.log(`[MessageProcessor] Processing change for ${filepath}`);
    console.log(`[MessageProcessor] Content length: ${content.length} chars`);

    if (!content.trim()) {
      console.log(`[MessageProcessor] Content is empty/whitespace, skipping`);
      return;
    }

    try {
      const parser = ParserFactory.createParser(profile.parser);
      console.log(`[MessageProcessor] Using parser: ${profile.parser.type}`);
      
      const messages = parser.parse(content);
      console.log(`[MessageProcessor] Parser returned ${messages.length} messages`);

      if (messages.length === 0) {
        console.log(`[MessageProcessor] No messages parsed, skipping`);
        return;
      }

      const filterChain = new FilterChain(profile.filters || []);

      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        console.log(`[MessageProcessor] Processing message ${i + 1}/${messages.length}`);
        console.log(`[MessageProcessor] Original: ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`);
        
        const filteredMessage = filterChain.apply(message);
        
        if (!filteredMessage || !filteredMessage.content.trim()) {
          console.log(`[MessageProcessor] Message filtered out or empty after filtering`);
          continue;
        }
        
        console.log(`[MessageProcessor] Filtered: ${filteredMessage.content.substring(0, 100)}${filteredMessage.content.length > 100 ? '...' : ''}`);

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