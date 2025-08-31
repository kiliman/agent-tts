import { BaseParser } from './base-parser';
import { ParsedMessage } from '../types/config';
import type { Message, TextBlock } from '@anthropic-ai/sdk/resources/messages';

export class ClaudeCodeParser extends BaseParser {
  parse(content: string): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    const lines = content.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        
        // Only process assistant messages (skip user, tool results, etc)
        if (data.type !== 'assistant' || !data.message) {
          continue;
        }
        
        const message = data.message as Message;
        
        // Extract text from the message content
        const text = this.extractTextFromMessage(message);
        if (!text || !text.trim()) {
          continue;
        }
        
        // Parse timestamp
        const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
        
        messages.push({
          role: 'assistant',
          content: text,
          timestamp
        });
      } catch (error) {
        // Skip invalid JSON lines
        console.log(`[ClaudeCodeParser] Skipping invalid JSON line: ${error}`);
      }
    }

    return messages;
  }
  
  private extractTextFromMessage(message: Message): string {
    if (!message.content || !Array.isArray(message.content)) {
      return '';
    }

    const textParts: string[] = [];

    for (const block of message.content) {
      if (block.type === 'text') {
        const textBlock = block as TextBlock;
        textParts.push(textBlock.text);
      }
      // Skip tool_use blocks, thinking blocks, etc.
    }

    return textParts.join('\n\n');
  }
}