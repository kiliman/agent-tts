import { BaseFilter } from './base-filter.js'
import { ParsedMessage } from '../types/config.js'

/**
 * Filter that removes emoji characters from text
 * This prevents TTS engines from reading emoji names aloud
 *
 * No more "party poopers" when you meant 🎉!
 */
export class EmojiFilter extends BaseFilter {
  constructor() {
    super('emoji-filter')
  }

  filter(message: ParsedMessage): ParsedMessage | null {
    if (!message.content) return message

    // Comprehensive regex to match emojis
    // This covers:
    // - Basic emojis (😀-🙏)
    // - Supplemental symbols (🚀-🛿)
    // - Emoticons (☺️, ♥️, etc.)
    // - Dingbats (✨, ❤️, etc.)
    // - Flags (🇺🇸, etc.)
    // - Skin tone modifiers
    // - Zero-width joiners for compound emojis
    const emojiRegex =
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F0CF}]|[\u{1F18E}]|[\u{1F191}-\u{1F19A}]|[\u{1F201}]|[\u{1F21A}]|[\u{1F22F}]|[\u{1F232}-\u{1F236}]|[\u{1F238}-\u{1F23A}]|[\u{1F250}-\u{1F251}]|[\u{200D}]|[\u{E0020}-\u{E007F}]/gu

    // Remove emojis and clean up any extra whitespace left behind
    const filteredContent = message.content.replace(emojiRegex, '').replace(/\s+/g, ' ').trim()

    return {
      ...message,
      content: filteredContent,
    }
  }
}
