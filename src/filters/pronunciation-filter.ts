import { BaseFilter } from './base-filter';
import { ParsedMessage } from '../types/config';

export class PronunciationFilter extends BaseFilter {
  private replacements: Map<string, string> = new Map([
    ['git', 'ghit'],
    ['github', 'ghit hub'],
    ['gif', 'jiff'],
    ['npm', 'N P M'],
    ['api', 'A P I'],
    ['url', 'U R L'],
    ['sql', 'sequel'],
    ['sqlite', 'sequel light'],
    ['json', 'jay son'],
    ['xml', 'X M L'],
    ['html', 'H T M L'],
    ['css', 'C S S'],
    ['js', 'javascript'],
    ['ts', 'typescript'],
    ['ui', 'U I'],
    ['ux', 'U X'],
    ['cli', 'C L I'],
    ['gui', 'gooey'],
    ['ide', 'I D E'],
    ['os', 'O S'],
    ['io', 'I O'],
    ['tts', 'text to speech'],
    ['async', 'a sync'],
    ['sync', 'sink'],
    ['regex', 'reg ex'],
    ['enum', 'e num'],
    ['init', 'initialize'],
    ['config', 'configuration'],
    ['env', 'environment'],
    ['dev', 'development'],
    ['prod', 'production'],
    ['repo', 'repository'],
    ['auth', 'authentication'],
    ['oauth', 'oh auth'],
    ['uuid', 'U U I D'],
    ['guid', 'G U I D'],
    ['crud', 'C R U D'],
    ['rest', 'REST'],
    ['graphql', 'graph Q L'],
    ['yaml', 'yam-ul'],
    ['dll', 'D L L'],
    ['exe', 'E X E'],
    ['pdf', 'P D F'],
    ['png', 'P N G'],
    ['jpg', 'J P G'],
    ['jpeg', 'J P E G'],
    ['svg', 'S V G'],
    ['mp3', 'M P 3'],
    ['mp4', 'M P 4']
  ]);

  constructor() {
    super('pronunciation', true);
  }

  filter(message: ParsedMessage): ParsedMessage | null {
    if (!this.enabled) return message;

    let content = message.content;

    for (const [original, replacement] of this.replacements) {
      const regex = new RegExp(`\\b${original}\\b`, 'gi');
      content = content.replace(regex, replacement);
    }

    content = content.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    content = content.replace(/\b([A-Z]{2,})\b/g, (match) => {
      return match.split('').join(' ');
    });

    return {
      ...message,
      content
    };
  }

  addReplacement(original: string, replacement: string): void {
    this.replacements.set(original.toLowerCase(), replacement);
  }

  removeReplacement(original: string): void {
    this.replacements.delete(original.toLowerCase());
  }
}