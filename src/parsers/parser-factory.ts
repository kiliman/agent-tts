import { BaseParser } from './base-parser.js'
import { ClaudeCodeParser } from './claude-code-parser.js'
import { OpenCodeParser } from './opencode-parser.js'
import { ParserConfig, ParsedMessage } from '../types/config.js'

export class ParserFactory {
  static createParser(config: ParserConfig): BaseParser {
    switch (config.type) {
      case 'claude-code':
        return new ClaudeCodeParser()

      case 'opencode':
        return new OpenCodeParser()

      case 'custom':
        if (!config.customParser) {
          throw new Error('Custom parser requires a customParser function')
        }
        return new CustomParser(config.customParser)

      default:
        throw new Error(`Unknown parser type: ${(config as any).type}`)
    }
  }
}

class CustomParser extends BaseParser {
  constructor(private customParserFn: (content: string) => ParsedMessage[]) {
    super()
  }

  parse(content: string): ParsedMessage[] {
    return this.customParserFn(content)
  }
}
