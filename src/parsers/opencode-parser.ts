import { BaseParser } from './base-parser';
import { ParsedMessage } from '../types/config';

export class OpenCodeParser extends BaseParser {
  parse(content: string): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    const lines = content.split('\n');
    
    let currentRole: 'user' | 'assistant' | null = null;
    let currentContent: string[] = [];
    let inCodeBlock = false;
    let timestamp: Date | undefined;

    for (const line of lines) {
      if (line.match(/^(User|You):/i)) {
        if (currentRole && currentContent.length > 0) {
          messages.push({
            role: currentRole,
            content: this.cleanContent(currentContent.join(' ')),
            timestamp
          });
        }
        currentRole = 'user';
        currentContent = [];
        timestamp = this.extractTimestamp(line);
        
        const contentAfterLabel = line.replace(/^(User|You):\s*/i, '').trim();
        if (contentAfterLabel) {
          currentContent.push(contentAfterLabel);
        }
      } else if (line.match(/^(Assistant|AI|Bot):/i)) {
        if (currentRole && currentContent.length > 0) {
          messages.push({
            role: currentRole,
            content: this.cleanContent(currentContent.join(' ')),
            timestamp
          });
        }
        currentRole = 'assistant';
        currentContent = [];
        timestamp = this.extractTimestamp(line);
        
        const contentAfterLabel = line.replace(/^(Assistant|AI|Bot):\s*/i, '').trim();
        if (contentAfterLabel) {
          currentContent.push(contentAfterLabel);
        }
      } else if (line.includes('```')) {
        inCodeBlock = !inCodeBlock;
        if (!inCodeBlock && currentRole) {
          currentContent.push('[code block]');
        }
      } else if (!inCodeBlock && currentRole) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('<') && !trimmedLine.startsWith('---')) {
          currentContent.push(trimmedLine);
        }
      }
    }

    if (currentRole && currentContent.length > 0) {
      messages.push({
        role: currentRole,
        content: this.cleanContent(currentContent.join(' ')),
        timestamp
      });
    }

    return messages;
  }
}