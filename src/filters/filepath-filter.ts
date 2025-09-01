import { BaseFilter } from './base-filter.js';
import { ParsedMessage } from '../types/config.js';

/**
 * Filter that simplifies file paths for TTS
 * Instead of reading out full paths, it just says the filename or last directory
 * 
 * Handles:
 * - Unix/Mac paths: /usr/local/bin/node -> "node"
 * - Windows paths: C:\Users\Michael\file.txt -> "file.txt"
 * - Relative paths: ./src/components/Button.tsx -> "Button.tsx"
 * - Home paths: ~/Documents/project/ -> "project"
 * - Paths in backticks, quotes, or parentheses
 */
export class FilepathFilter extends BaseFilter {
  constructor() {
    super('filepath-filter');
  }
  
  filter(message: ParsedMessage): ParsedMessage | null {
    if (!message.content) return message;
    
    let filteredContent = message.content;
    
    // Match paths in backticks first (most common in technical docs)
    // This captures paths like `~/.local/share/opencode/project/`
    const backtickPathRegex = /`([^`]*(?:[\\\/])[^`]*)`/g;
    filteredContent = filteredContent.replace(backtickPathRegex, (match, path) => {
      // Replace Windows environment variables within the path
      const pathWithReplacedVars = path.replace(/%[A-Z_]+%/g, '');
      const simplified = this.simplifyPath(pathWithReplacedVars);
      return `\`${simplified}\``;
    });
    
    // Match paths in quotes
    const quotedPathRegex = /"([^"]*(?:[\\\/])[^"]*)"/g;
    filteredContent = filteredContent.replace(quotedPathRegex, (match, path) => {
      const simplified = this.simplifyPath(path);
      return `"${simplified}"`;
    });
    
    // Match paths in parentheses (like in your example)
    const parenPathRegex = /\(([^)]*(?:[\\\/])[^)]*)\)/g;
    filteredContent = filteredContent.replace(parenPathRegex, (match, path) => {
      // Only process if it looks like a path (has slashes and common path indicators)
      if (this.looksLikePath(path)) {
        const simplified = this.simplifyPath(path);
        return `(${simplified})`;
      }
      return match;
    });
    
    // Match standalone obvious paths (be more conservative here)
    // This handles paths that aren't in quotes/backticks but are clearly paths
    const standalonePaths = /(?:^|\s)((?:~|\.{1,2})?[\\\/][\w.-]+(?:[\\\/][\w.-]+)+[\\\/]?)(?=\s|$)/g;
    filteredContent = filteredContent.replace(standalonePaths, (match, path) => {
      const simplified = this.simplifyPath(path);
      return match.replace(path, simplified);
    });
    
    return {
      ...message,
      content: filteredContent
    };
  }
  
  private simplifyPath(path: string): string {
    // Handle paths with placeholders like <project-slug>
    if (path.includes('<') && path.includes('>')) {
      // Extract the actual directory name after the placeholder
      const afterPlaceholder = path.split('>')[1];
      if (afterPlaceholder) {
        path = afterPlaceholder;
      }
    }
    
    // Remove trailing slashes
    path = path.replace(/[\\\/]+$/, '');
    
    // Split by both forward and back slashes
    const segments = path.split(/[\\\/]/);
    
    // Get the last meaningful segment
    const lastSegment = segments[segments.length - 1];
    
    // If the last segment is empty or just dots, get the second to last
    if (!lastSegment || lastSegment === '.' || lastSegment === '..') {
      const secondLast = segments[segments.length - 2];
      if (secondLast) {
        return secondLast;
      }
    }
    
    // If it's a hidden file/folder (starts with .) keep it
    // If it's a file with extension, keep it
    // If it's a directory name, keep it
    if (lastSegment) {
      // For very common directory names, we might want to include parent
      if (['storage', 'share', 'local', 'bin', 'lib', 'src', 'dist'].includes(lastSegment.toLowerCase())) {
        // Get parent directory for context
        const parent = segments[segments.length - 2];
        if (parent && parent !== '.' && parent !== '..') {
          return `${parent}/${lastSegment}`;
        }
      }
      return lastSegment;
    }
    
    // Fallback to just saying "filepath"
    return 'filepath';
  }
  
  private looksLikePath(text: string): boolean {
    // Check if text contains path separators and common path indicators
    const hasPathSeparators = /[\\\/]/.test(text);
    const hasPathIndicators = /^(?:\.|~|\/|[A-Za-z]:|\\\\)/.test(text);
    const hasFileExtension = /\.\w{1,4}$/.test(text);
    
    return hasPathSeparators && (hasPathIndicators || hasFileExtension);
  }
}