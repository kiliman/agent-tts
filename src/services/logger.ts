import { appendFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { AGENT_TTS_PATHS } from '../utils/xdg-paths.js'

// Store original console methods before replacement
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
  info: console.info,
  trace: console.trace,
  table: console.table,
  dir: console.dir,
  time: console.time,
  timeEnd: console.timeEnd,
  timeLog: console.timeLog,
  assert: console.assert,
  clear: console.clear,
  count: console.count,
  countReset: console.countReset,
  group: console.group,
  groupCollapsed: console.groupCollapsed,
  groupEnd: console.groupEnd,
}

class Logger {
  private logDir: string
  private currentLogFile: string | null = null
  private currentDate: string | null = null

  constructor() {
    this.logDir = join(AGENT_TTS_PATHS.state, 'logs')
    this.ensureLogFile()
  }

  private ensureLogFile(): void {
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0] // YYYY-MM-DD

    if (dateStr !== this.currentDate) {
      this.currentDate = dateStr
      const dayDir = join(this.logDir, dateStr)

      // Create directory if it doesn't exist
      if (!existsSync(dayDir)) {
        mkdirSync(dayDir, { recursive: true })
      }

      this.currentLogFile = join(dayDir, 'log')
    }
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    // Format the message with any additional arguments
    let fullMessage = message
    if (args.length > 0) {
      // Convert args to strings and append
      const argStrings = args.map((arg) => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2)
          } catch {
            return String(arg)
          }
        }
        return String(arg)
      })
      fullMessage = `${message} ${argStrings.join(' ')}`
    }
    return fullMessage
  }

  private writeToFile(level: string, message: string): void {
    this.ensureLogFile()
    if (this.currentLogFile) {
      const timestamp = new Date().toISOString()
      const logEntry = `${timestamp} [${level}] ${message}\n`
      try {
        appendFileSync(this.currentLogFile, logEntry)
      } catch (error) {
        // If we can't write to file, just continue (don't create infinite loop)
      }
    }
  }

  log(message: string, ...args: any[]): void {
    const formatted = this.formatMessage('INFO', message, ...args)
    originalConsole.log(message, ...args) // Use original console without timestamp
    this.writeToFile('INFO', formatted)
  }

  error(message: string, ...args: any[]): void {
    const formatted = this.formatMessage('ERROR', message, ...args)
    originalConsole.error(message, ...args) // Use original console without timestamp
    this.writeToFile('ERROR', formatted)
  }

  warn(message: string, ...args: any[]): void {
    const formatted = this.formatMessage('WARN', message, ...args)
    originalConsole.warn(message, ...args) // Use original console without timestamp
    this.writeToFile('WARN', formatted)
  }

  debug(message: string, ...args: any[]): void {
    const formatted = this.formatMessage('DEBUG', message, ...args)
    originalConsole.debug(message, ...args) // Use original console without timestamp
    this.writeToFile('DEBUG', formatted)
  }
}

// Export singleton instance
export const logger = new Logger()

// Also export a function that replaces console methods globally
export function replaceConsoleWithLogger(): void {
  console.log = (...args: any[]) => {
    const [message, ...rest] = args
    logger.log(message || '', ...rest)
  }

  console.error = (...args: any[]) => {
    const [message, ...rest] = args
    logger.error(message || '', ...rest)
  }

  console.warn = (...args: any[]) => {
    const [message, ...rest] = args
    logger.warn(message || '', ...rest)
  }

  console.debug = (...args: any[]) => {
    const [message, ...rest] = args
    logger.debug(message || '', ...rest)
  }

  // Keep other console methods intact
  console.info = originalConsole.info
  console.trace = originalConsole.trace
  console.table = originalConsole.table
  console.dir = originalConsole.dir
  console.time = originalConsole.time
  console.timeEnd = originalConsole.timeEnd
  console.timeLog = originalConsole.timeLog
  console.assert = originalConsole.assert
  console.clear = originalConsole.clear
  console.count = originalConsole.count
  console.countReset = originalConsole.countReset
  console.group = originalConsole.group
  console.groupCollapsed = originalConsole.groupCollapsed
  console.groupEnd = originalConsole.groupEnd
}
