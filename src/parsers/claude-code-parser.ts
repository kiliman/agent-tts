import { BaseParser, LogMode } from './base-parser.js'
import { ParsedMessage } from '../types/config.js'
import type { Message, TextBlock } from '@anthropic-ai/sdk/resources/messages'
import { extractImagesFromMessage, extractVisionImages } from '../utils/image-extractor.js'

export class ClaudeCodeParser extends BaseParser {
  getLogMode(): LogMode {
    // Claude Code appends to a single JSONL file
    return 'append'
  }

  async parse(content: string): Promise<ParsedMessage[]> {
    const messages: ParsedMessage[] = []
    const lines = content.split('\n').filter((line) => line.trim())

    // Try to find cwd from the first message that has it
    let cwd: string | undefined
    for (const line of lines) {
      try {
        const data = JSON.parse(line)
        if (data.cwd) {
          cwd = data.cwd
          break
        }
      } catch {
        // Skip invalid JSON
      }
    }

    for (const line of lines) {
      try {
        const data = JSON.parse(line)

        // Process both user and assistant messages
        if (data.type === 'user' && data.message && data.message.role === 'user') {
          // Skip meta messages (like command caveats)
          if (data.isMeta === true) {
            continue
          }

          // Skip sidechain messages (sub-agent conversations)
          if (data.isSidechain === true) {
            continue
          }

          let content: string = ''
          let imagePaths: string[] = []

          if (typeof data.message.content === 'string') {
            content = data.message.content
          } else if (Array.isArray(data.message.content)) {
            // Skip tool result messages (subagent responses)
            const hasToolResult = data.message.content.some(
              (item: any) => item && typeof item === 'object' && item.type === 'tool_result',
            )
            if (hasToolResult) {
              continue
            }

            // Extract text content and images from array
            const textParts: string[] = []
            for (const item of data.message.content) {
              if (item && typeof item === 'object' && item.type === 'text' && item.text) {
                textParts.push(item.text)
              }
            }
            content = textParts.join('\n\n')

            // Extract images from the content array
            imagePaths = await extractImagesFromMessage(data.message.content)
          }

          // Skip messages that contain command tags or are empty
          if (!content || !content.trim()) {
            continue
          }

          // Skip command-related messages
          if (this.isCommandMessage(content)) {
            continue
          }

          const timestamp = data.timestamp ? new Date(data.timestamp) : new Date()
          messages.push({
            role: 'user',
            content: content,
            timestamp,
            cwd: data.cwd || cwd,
            images: imagePaths.length > 0 ? imagePaths : undefined,
          })
        } else if (data.type === 'assistant' && data.message) {
          // Skip sidechain messages (sub-agent conversations)
          if (data.isSidechain === true) {
            continue
          }

          // Process assistant message
          const message = data.message as Message

          // Extract text from the message content
          const text = this.extractTextFromMessage(message)
          if (!text || !text.trim()) {
            continue
          }

          // Extract vision images from <vision> tags in assistant message
          const visionImages = await extractVisionImages(text)

          // Parse timestamp
          const timestamp = data.timestamp ? new Date(data.timestamp) : new Date()

          messages.push({
            role: 'assistant',
            content: text,
            timestamp,
            cwd: data.cwd || cwd, // Use message-specific cwd if available, otherwise use the file-level cwd
            images: visionImages.length > 0 ? visionImages : undefined,
          })
        }
      } catch (error) {
        // Skip invalid JSON lines
        console.log(`[ClaudeCodeParser] Skipping invalid JSON line: ${error}`)
      }
    }

    return messages
  }

  private extractTextFromMessage(message: Message): string {
    if (!message.content || !Array.isArray(message.content)) {
      return ''
    }

    const textParts: string[] = []

    for (const block of message.content) {
      if (block.type === 'text') {
        const textBlock = block as TextBlock
        textParts.push(textBlock.text)
      }
      // Skip tool_use blocks, thinking blocks, etc.
    }

    return textParts.join('\n\n')
  }

  private isCommandMessage(content: string): boolean {
    // Check for command-related tags and patterns
    const commandPatterns = [
      /<command-name>/,
      /<\/command-name>/,
      /<command-message>/,
      /<\/command-message>/,
      /<command-args>/,
      /<\/command-args>/,
      /<local-command-stdout>/,
      /<\/local-command-stdout>/,
      /^Caveat:\s*The messages below were generated by the user while running local commands/i,
    ]

    return commandPatterns.some((pattern) => pattern.test(content))
  }
}
