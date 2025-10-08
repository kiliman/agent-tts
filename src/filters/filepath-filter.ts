import { BaseFilter } from './base-filter.js'
import { ParsedMessage } from '../types/config.js'

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
    super('filepath-filter')
  }

  filter(message: ParsedMessage): ParsedMessage | null {
    if (!message.content) return message

    let filteredContent = message.content

    // Match paths in backticks first (most common in technical docs)
    // This captures paths like `~/.local/share/opencode/project/`
    const backtickPathRegex = /`([^`]*(?:[\\\/])[^`]*)`/g
    filteredContent = filteredContent.replace(backtickPathRegex, (match, path) => {
      // Replace Windows environment variables within the path
      const pathWithReplacedVars = path.replace(/%[A-Z_]+%/g, '')
      const simplified = this.simplifyPath(pathWithReplacedVars)
      return `\`${simplified}\``
    })

    // Match paths in quotes
    const quotedPathRegex = /"([^"]*(?:[\\\/])[^"]*)"/g
    filteredContent = filteredContent.replace(quotedPathRegex, (match, path) => {
      const simplified = this.simplifyPath(path)
      return `"${simplified}"`
    })

    // Match paths in parentheses (like in your example)
    const parenPathRegex = /\(([^)]*(?:[\\\/])[^)]*)\)/g
    filteredContent = filteredContent.replace(parenPathRegex, (match, path) => {
      // Only process if it looks like a path (has slashes and common path indicators)
      if (this.looksLikePath(path)) {
        const simplified = this.simplifyPath(path)
        return `(${simplified})`
      }
      return match
    })

    // Match standalone obvious paths (be more conservative here)
    // This handles paths that aren't in quotes/backticks but are clearly paths
    // Updated regex to better catch absolute paths like /Users/michael/Projects/oss/agent-tts
    const standalonePaths =
      /(?:^|\s|,\s*)((?:\/[A-Za-z][\w.-]*|~|\.{1,2}|[A-Za-z]:)(?:[\\\/][\w.-]+)+[\\\/]?)(?=\s|,|$|\))/g
    filteredContent = filteredContent.replace(standalonePaths, (match, path) => {
      const simplified = this.simplifyPath(path)
      return match.replace(path, simplified)
    })

    // Also catch paths that start with tilde and are expanded
    const tildeExpandedPaths = /(?:^|\s|,\s*)(~[\\\/][\w.-]+(?:[\\\/][\w.-]+)*[\\\/]?)(?=\s|,|$|\))/g
    filteredContent = filteredContent.replace(tildeExpandedPaths, (match, path) => {
      const simplified = this.simplifyPath(path)
      return match.replace(path, simplified)
    })

    return {
      ...message,
      content: filteredContent,
    }
  }

  private simplifyPath(path: string): string {
    // Handle paths with placeholders like <project-slug>
    if (path.includes('<') && path.includes('>')) {
      // Extract the actual directory name after the placeholder
      const afterPlaceholder = path.split('>')[1]
      if (afterPlaceholder) {
        path = afterPlaceholder
      }
    }

    // Remove trailing slashes
    path = path.replace(/[\\\/]+$/, '')

    // Split by both forward and back slashes
    const segments = path.split(/[\\\/]/)

    // Filter out empty segments
    const meaningfulSegments = segments.filter((s) => s && s !== '.' && s !== '..')

    // If path is very long (like /Users/michael/Projects/oss/agent-tts), just use the last segment
    if (meaningfulSegments.length > 4) {
      const lastSegment = meaningfulSegments[meaningfulSegments.length - 1]
      // For project names, they're usually distinctive enough
      // Replace dots in filenames with "dot" for better pronunciation
      return this.replaceDotWithWord(lastSegment)
    }

    // Get the last meaningful segment
    const lastSegment = meaningfulSegments[meaningfulSegments.length - 1]

    // If no meaningful segments, fallback
    if (!lastSegment) {
      return 'filepath'
    }

    // For very common directory names, we might want to include parent
    if (['storage', 'share', 'local', 'bin', 'lib', 'src', 'dist', 'oss'].includes(lastSegment.toLowerCase())) {
      // Get parent directory for context
      const parent = meaningfulSegments[meaningfulSegments.length - 2]
      if (parent) {
        // Replace slash with " slash " for better TTS pronunciation
        // Also replace dots in both segments
        return `${this.replaceDotWithWord(parent)} slash ${this.replaceDotWithWord(lastSegment)}`
      }
    }

    // For most cases, just return the last segment (project name, filename, etc)
    // Replace dots with "dot" for better pronunciation of file extensions
    return this.replaceDotWithWord(lastSegment)
  }

  private replaceDotWithWord(segment: string): string {
    // Check if this looks like a file with extension (e.g., "file.txt", "script.js")
    if (segment.includes('.')) {
      // Split by dot to handle multiple extensions like .test.js
      const parts = segment.split('.')
      if (parts.length > 1) {
        // Process each part
        const processedParts = parts.map((part, index) => {
          // If it's after a dot and looks like a file extension (short, alphanumeric)
          if (index > 0 && part.length <= 4 && /^[a-zA-Z0-9]+$/.test(part)) {
            // Convert to uppercase and space out the letters (e.g., "tsx" -> "T S X")
            return part.toUpperCase().split('').join(' ')
          }
          return part
        })
        // Join with " dot " for clear pronunciation
        return processedParts.join(' dot ')
      }
    }
    return segment
  }

  private looksLikePath(text: string): boolean {
    // Check if text contains path separators and common path indicators
    const hasPathSeparators = /[\\\/]/.test(text)
    const hasPathIndicators = /^(?:\.|~|\/|[A-Za-z]:|\\\\)/.test(text)
    const hasFileExtension = /\.\w{1,4}$/.test(text)

    return hasPathSeparators && (hasPathIndicators || hasFileExtension)
  }
}
