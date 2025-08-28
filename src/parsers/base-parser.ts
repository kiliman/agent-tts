import { ParsedMessage } from '../types/config';

export abstract class BaseParser {
  abstract parse(content: string): ParsedMessage[];
  
  protected extractTimestamp(line: string): Date | undefined {
    const timestampMatch = line.match(/\[(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}[\.\d]*Z?)\]/);
    if (timestampMatch) {
      return new Date(timestampMatch[1]);
    }
    return undefined;
  }

  protected cleanContent(content: string): string {
    return content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, 'code')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*{1,3}([^\*]+)\*{1,3}/g, '$1')
      .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}