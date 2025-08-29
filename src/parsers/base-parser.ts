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
      // Remove code blocks entirely (triple backticks)
      .replace(/```[\s\S]*?```/g, '')
      // Keep inline code content but remove backticks
      .replace(/`([^`]+)`/g, '$1')
      // Convert links to just their text
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // Remove headers but keep text
      .replace(/#{1,6}\s+/g, '')
      // Remove bold/italic markers
      .replace(/\*{1,3}([^\*]+)\*{1,3}/g, '$1')
      .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
      // Remove strikethrough
      .replace(/~~([^~]+)~~/g, '$1')
      // Remove list markers
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }
}