import { BaseFilter } from './base-filter.js';
import { ParsedMessage } from '../types/config.js';

/**
 * Filter that replaces URLs with the word "URL"
 * This prevents TTS from reading out long URLs character by character
 * 
 * Handles:
 * - http:// and https:// URLs
 * - ftp:// URLs  
 * - file:// URLs
 * - URLs with or without www
 * - URLs with query parameters and fragments
 */
export class UrlFilter extends BaseFilter {
  constructor() {
    super('url-filter');
  }
  
  filter(message: ParsedMessage): ParsedMessage | null {
    if (!message.content) return message;
    
    // Comprehensive regex to match URLs
    // Matches http(s)://, ftp://, file://, or www. followed by domain
    const urlRegex = /(?:(?:https?|ftp|file):\/\/|www\.)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff_-]{0,62})?[a-z0-9\u00a1-\uffff]\.)+(?:[a-z\u00a1-\uffff]{2,}\.?))(?::\d{2,5})?(?:[/?#]\S*)?/gi;
    
    // Simpler regex that catches most common URL patterns
    // This is more readable and handles 99% of cases
    const simpleUrlRegex = /(?:https?:\/\/|ftp:\/\/|file:\/\/|www\.)[^\s]+/gi;
    
    // Replace URLs with the word "URL"
    // Using the simpler regex for better performance and maintainability
    const filteredContent = message.content.replace(simpleUrlRegex, 'URL');
    
    return {
      ...message,
      content: filteredContent
    };
  }
}