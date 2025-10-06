import { BaseFilter } from './base-filter.js';
import { ParsedMessage } from '../types/config.js';

export class LengthFilter extends BaseFilter {
  private maxLength: number;
  private truncateIndicator: string;

  constructor(maxLength: number = 500, truncateIndicator: string = '...') {
    super('length', true);
    this.maxLength = maxLength;
    this.truncateIndicator = truncateIndicator;
  }

  filter(message: ParsedMessage): ParsedMessage | null {
    if (!this.enabled) return message;

    if (message.content.length <= this.maxLength) {
      return message;
    }

    const sentences = message.content.match(/[^.!?]+[.!?]+/g) || [message.content];
    let truncatedContent = '';
    
    for (const sentence of sentences) {
      if (truncatedContent.length + sentence.length <= this.maxLength) {
        truncatedContent += sentence;
      } else {
        if (truncatedContent.length === 0) {
          truncatedContent = message.content.substring(0, this.maxLength - this.truncateIndicator.length);
        }
        break;
      }
    }

    return {
      ...message,
      content: truncatedContent + this.truncateIndicator
    };
  }

  setMaxLength(maxLength: number): void {
    this.maxLength = maxLength;
  }

  getMaxLength(): number {
    return this.maxLength;
  }
}