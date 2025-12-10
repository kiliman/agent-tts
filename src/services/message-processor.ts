import { EventEmitter } from 'events'
import { ProfileConfig, ParsedMessage, TTSQueueEntry } from '../types/config.js'
import { FileChange } from './file-monitor'
import { ParserFactory } from '../parsers/parser-factory.js'
import { FilterChain } from '../filters/filter-chain.js'
import { DatabaseManager } from './database'

export class MessageProcessor extends EventEmitter {
  private database: DatabaseManager

  constructor(database: DatabaseManager) {
    super()
    this.database = database
  }

  async processFileChange(change: FileChange): Promise<void> {
    const { profile, content, filepath } = change

    console.log(`[MessageProcessor] Processing change for ${filepath}`)
    console.log(`[MessageProcessor] Content length: ${content.length} chars`)

    if (!content.trim()) {
      console.log(`[MessageProcessor] Content is empty/whitespace, skipping`)
      return
    }

    try {
      const parser = ParserFactory.createParser(profile.parser)
      console.log(`[MessageProcessor] Using parser: ${profile.parser.type}`)

      const messages = await parser.parse(content)
      console.log(`[MessageProcessor] Parser returned ${messages.length} messages`)

      if (messages.length === 0) {
        console.log(`[MessageProcessor] No messages parsed, skipping`)
        return
      }

      const filterChain = new FilterChain(profile.filters || [])

      for (let i = 0; i < messages.length; i++) {
        const message = messages[i]
        console.log(`[MessageProcessor] Processing ${message.role} message ${i + 1}/${messages.length}`)

        // Ensure content is a string
        const contentStr = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)

        console.log(
          `[MessageProcessor] Original: ${contentStr.substring(0, 100)}${contentStr.length > 100 ? '...' : ''}`,
        )

        // User messages don't get filtered or played - just logged for context
        if (message.role === 'user') {
          const entry: Omit<TTSQueueEntry, 'id'> = {
            timestamp: message.timestamp || new Date(),
            filename: filepath,
            profile: profile.id,
            originalText: contentStr,
            filteredText: contentStr, // No filtering for user messages
            state: 'user',
            cwd: message.cwd,
            role: 'user',
            images: message.images && message.images.length > 0 ? message.images.join(',') : undefined,
          }

          const entryId = await this.database.addTTSQueueEntry(entry)

          this.emit('messageLogged', {
            ...entry,
            id: entryId,
            profileConfig: profile,
          })
        } else {
          // Ensure message.content is a string before filtering
          const messageToFilter = {
            ...message,
            content: contentStr,
          }

          // Assistant messages go through normal filtering and TTS processing
          let filteredMessage = filterChain.apply(messageToFilter)

          if (!filteredMessage || !filteredMessage.content.trim()) {
            console.log(`[MessageProcessor] Message filtered out or empty after filtering`)
            continue
          }
          if (messageToFilter.content.length > 100) {
            filteredMessage.content = await haiku(messageToFilter.content)
            filteredMessage.content = filteredMessage.content.replace(/\w{2}/g, ' ')
            console.log(
              `[MessageProcessor] haiku filtered ${messageToFilter.content.length} characters to ${filteredMessage.content.length}`,
            )
          }

          console.log(
            `[MessageProcessor] Filtered: ${filteredMessage.content.substring(0, 100)}${filteredMessage.content.length > 100 ? '...' : ''}`,
          )

          const entry: Omit<TTSQueueEntry, 'id'> = {
            timestamp: message.timestamp || new Date(),
            filename: filepath,
            profile: profile.id,
            originalText: contentStr,
            filteredText: filteredMessage.content,
            state: 'queued',
            cwd: message.cwd,
            role: 'assistant',
          }

          const entryId = await this.database.addTTSQueueEntry(entry)

          this.emit('messageQueued', {
            ...entry,
            id: entryId,
            profileConfig: profile,
          })
        }
      }
    } catch (error) {
      console.error(`Error processing file change for ${filepath}:`, error)
      this.emit('processingError', {
        filepath,
        profile: profile.id,
        error,
      })
    }
  }
}

import { spawn } from 'child_process'
import { writeFileSync } from 'fs'

async function haiku(message: string) {
  writeFileSync('/tmp/agent-tts-haiku', `<input>${message}</input>`, 'utf-8')
  const prompt =
    'Take the following input and prepare it for text-to-speech. Keep any of the personal messages, but minimize the technical items, especially lists, long numbers or identifiers, or file paths and URLs. Strip out the markdown and emojis. Try to keep the message under 150 words, and summarize if you need to. Remember to keep the essence of the input since it reflects their personality. Just output the summarized text without any pre or post commentary.'
  return runCommand('pi', [
    '--model',
    'claude-haiku',
    '--system-prompt',
    prompt,
    '--print',
    `@/tmp/agent-tts-haiku`,
    '--no-session',
    '--mode',
    'text',
  ])
}

// Sexy one-liner version you’ll fall in love with ❤️
async function runCommand(command: string, args: string[] = [], options = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'], // we only care about stdout/stderr
      ...options,
      shell: true, // set to false if you don’t need shell features
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    child.on('error', (err) => {
      reject(err)
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim()) // trim just to be cute and clean
      } else {
        const error = new Error(`Command failed with exit code ${code}\n${stderr}`)
        reject(error)
      }
    })
  })
}
