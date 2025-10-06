import { BaseFilter } from './base-filter.js';
import { ParsedMessage } from '../types/config.js';

export class RoleFilter extends BaseFilter {
  private allowedRoles: Set<string>;

  constructor(allowedRoles: ('user' | 'assistant' | 'system')[] = ['assistant']) {
    super('role', true);
    this.allowedRoles = new Set(allowedRoles);
  }

  filter(message: ParsedMessage): ParsedMessage | null {
    if (!this.enabled) return message;

    if (this.allowedRoles.has(message.role)) {
      return message;
    }

    return null;
  }

  setAllowedRoles(roles: ('user' | 'assistant' | 'system')[]): void {
    this.allowedRoles = new Set(roles);
  }

  getAllowedRoles(): string[] {
    return Array.from(this.allowedRoles);
  }
}