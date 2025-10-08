import { BaseFilter } from './base-filter.js'
import { ParsedMessage } from '../types/config.js'

/**
 * Filter that cleans markdown formatting and improves list readability for TTS
 *
 * Features:
 * - Removes code blocks and inline code markers
 * - Converts links to just their text
 * - Removes headers, bold, italic, strikethrough markers
 * - Adds periods to list items for natural TTS pauses
 * - Handles numbered lists, bullet lists, and dash lists
 */
export class MarkdownFilter extends BaseFilter {
  constructor() {
    super('markdown-filter')
  }

  filter(message: ParsedMessage): ParsedMessage | null {
    if (!message.content) return message

    let content = message.content

    // Remove code blocks entirely (triple backticks) - do this first
    content = content.replace(/```[\s\S]*?```/g, '')

    // Keep inline code content but remove backticks
    content = content.replace(/`([^`]+)`/g, '$1')

    // Convert links to just their text
    content = content.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')

    // Remove headers but keep text
    content = content.replace(/#{1,6}\s+/g, '')

    // Remove bold markers (but not list markers at start of line)
    content = content.replace(/\*\*([^\*]+)\*\*/g, '$1') // Bold with **
    content = content.replace(/\*\*\*([^\*]+)\*\*\*/g, '$1') // Bold+italic with ***

    // Remove italic markers (but not list markers at start of line)
    // Match single asterisks only if not at line start
    content = content.replace(/(?<!^\s*)\*([^\*\n]+)\*/g, '$1')
    content = content.replace(/_{1,3}([^_]+)_{1,3}/g, '$1')

    // Remove strikethrough
    content = content.replace(/~~([^~]+)~~/g, '$1')

    // Now add periods to list items if they don't already have punctuation
    // This needs to happen before we remove the list markers
    content = this.addPeriodsToListItems(content)

    // Remove only bullet list markers (but keep numbers for numbered lists)
    content = content.replace(/^\s*[-*+]\s+/gm, '')
    // For numbered lists, keep the number but remove the extra dot and space
    // Since we've already added periods, just clean up formatting
    content = content.replace(/^(\s*\d+)\.\s+/gm, '$1. ')

    // Normalize whitespace but preserve newlines for TTS pauses
    content = content.replace(/[^\S\n]+/g, ' ') // Replace all whitespace except newlines with single space
    content = content.replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines to max 2
    content = content.trim()

    // Skip empty messages
    if (!content) {
      return null
    }

    return {
      ...message,
      content,
    }
  }

  private addPeriodsToListItems(content: string): string {
    const lines = content.split('\n')
    const processedLines: string[] = []

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]
      const nextLine = lines[i + 1]

      // Check if current line is a list item
      const isListItem = this.isListItem(line)

      // Check if next line is a list item or empty
      const nextIsListItem = nextLine ? this.isListItem(nextLine) : false
      const nextIsEmpty = !nextLine || nextLine.trim() === ''

      // Look ahead to find the next non-empty line
      let nextNonEmptyLine = null
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() !== '') {
          nextNonEmptyLine = lines[j]
          break
        }
      }
      const nextNonEmptyIsListItem = nextNonEmptyLine ? this.isListItem(nextNonEmptyLine) : false

      // If this is a list item and doesn't end with punctuation, add a period
      if (isListItem && (nextIsListItem || nextIsEmpty || i === lines.length - 1)) {
        // Check if line ends with punctuation (excluding the list marker itself)
        const lineContent = this.getListItemContent(line)
        if (lineContent && !this.endsWithPunctuation(lineContent)) {
          // Add period to the content part, not the marker
          line = this.addPeriodToListItem(line)
        }
      }
      // If current line is NOT a list item but followed by a list (even with blank lines), ensure it ends with period
      // This handles headings/text before lists
      else if (!isListItem && nextNonEmptyIsListItem && line.trim() !== '') {
        const trimmed = line.trimEnd()
        if (!this.endsWithPunctuation(trimmed)) {
          // If it ends with a colon, replace it with a period
          if (trimmed.endsWith(':')) {
            line = trimmed.slice(0, -1) + '.'
          } else {
            line = trimmed + '.'
          }
        }
      }

      processedLines.push(line)
    }

    return processedLines.join('\n')
  }

  private isListItem(line: string): boolean {
    // Check for numbered lists (1. 2. etc)
    if (/^\s*\d+\.\s+/.test(line)) return true

    // Check for bullet lists (-, *, +)
    if (/^\s*[-*+]\s+/.test(line)) return true

    return false
  }

  private getListItemContent(line: string): string {
    // Remove list markers and get the actual content
    return line
      .replace(/^\s*\d+\.\s+/, '') // Remove numbered list markers
      .replace(/^\s*[-*+]\s+/, '') // Remove bullet list markers
      .trim()
  }

  private endsWithPunctuation(text: string): boolean {
    // Check if text ends with sentence-ending punctuation marks
    // Don't include colon or comma as they don't provide a full stop
    return /[.!?]$/.test(text.trim())
  }

  private addPeriodToListItem(line: string): string {
    // Add period to the end of the line (preserving trailing whitespace)
    const trimmedLine = line.trimEnd()
    const trailingWhitespace = line.slice(trimmedLine.length)
    return trimmedLine + '.' + trailingWhitespace
  }
}
