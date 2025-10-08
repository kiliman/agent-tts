import { ParsedMessage } from '../types/config.js'

export abstract class BaseFilter {
  constructor(
    protected name: string,
    protected enabled: boolean = true,
  ) {}

  abstract filter(message: ParsedMessage): ParsedMessage | null

  isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  getName(): string {
    return this.name
  }
}
