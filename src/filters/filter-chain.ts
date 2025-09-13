import { ParsedMessage, FilterConfig } from "../types/config.js";
import { BaseFilter } from "./base-filter.js";
import { PronunciationFilter } from "./pronunciation-filter.js";
import { LengthFilter } from "./length-filter.js";
import { RoleFilter } from "./role-filter.js";
import { EmojiFilter } from "./emoji-filter.js";
import { UrlFilter } from "./url-filter.js";
import { FilepathFilter } from "./filepath-filter.js";
import { MarkdownFilter } from "./markdown-filter.js";

export class FilterChain {
  private filters: BaseFilter[] = [];

  constructor(filterConfigs: FilterConfig[] = []) {
    this.initializeFilters(filterConfigs);
  }

  private initializeFilters(filterConfigs: FilterConfig[]): void {
    // Always start with default filters
    this.filters.push(new RoleFilter(["assistant"]));
    this.filters.push(new MarkdownFilter());
    this.filters.push(new UrlFilter());
    this.filters.push(new EmojiFilter());
    this.filters.push(new FilepathFilter());
    this.filters.push(new PronunciationFilter());

    // Apply user configurations to enhance/modify default filters
    for (const config of filterConfigs) {
      if (config.filter) {
        // Custom filter - add it
        const customFilter = new CustomFilter(
          config.name,
          config.filter,
          config.enabled ?? true
        );
        this.filters.push(customFilter);
      } else {
        // Built-in filter - find existing one and apply config
        const existingFilter = this.filters.find(f => f.getName() === config.name);
        if (existingFilter) {
          // Configure existing filter
          existingFilter.setEnabled(config.enabled ?? true);
          
          // Apply options if it's a pronunciation filter
          if (config.name === "pronunciation" && config.options) {
            const pronFilter = existingFilter as PronunciationFilter;
            for (const [key, value] of Object.entries(config.options)) {
              pronFilter.addReplacement(key, value as string);
            }
          }
        } else {
          // Unknown built-in filter - try to create it (for future extensibility)
          const builtInFilter = this.createBuiltInFilter(
            config.name,
            config.enabled ?? true,
            config.options
          );
          if (builtInFilter) {
            this.filters.push(builtInFilter);
          }
        }
      }
    }
  }

  private createBuiltInFilter(
    name: string,
    enabled: boolean,
    options?: any
  ): BaseFilter | null {
    switch (name) {
      case "pronunciation": {
        const pronunciationFilter = new PronunciationFilter(options);
        pronunciationFilter.setEnabled(enabled);
        return pronunciationFilter;
      }

      case "length": {
        const lengthFilter = new LengthFilter();
        lengthFilter.setEnabled(enabled);
        return lengthFilter;
      }

      case "role": {
        const roleFilter = new RoleFilter();
        roleFilter.setEnabled(enabled);
        return roleFilter;
      }

      case "emoji": {
        const emojiFilter = new EmojiFilter();
        emojiFilter.setEnabled(enabled);
        return emojiFilter;
      }

      case "url": {
        const urlFilter = new UrlFilter();
        urlFilter.setEnabled(enabled);
        return urlFilter;
      }

      case "filepath": {
        const filepathFilter = new FilepathFilter();
        filepathFilter.setEnabled(enabled);
        return filepathFilter;
      }

      case "markdown": {
        const markdownFilter = new MarkdownFilter();
        markdownFilter.setEnabled(enabled);
        return markdownFilter;
      }

      default:
        return null;
    }
  }

  apply(message: ParsedMessage): ParsedMessage | null {
    let currentMessage: ParsedMessage | null = message;

    for (const filter of this.filters) {
      if (!filter.isEnabled()) continue;

      currentMessage = filter.filter(currentMessage);

      if (!currentMessage) {
        return null;
      }
    }

    return currentMessage;
  }

  addFilter(filter: BaseFilter): void {
    this.filters.push(filter);
  }

  removeFilter(name: string): void {
    this.filters = this.filters.filter((f) => f.getName() !== name);
  }

  getFilter(name: string): BaseFilter | undefined {
    return this.filters.find((f) => f.getName() === name);
  }

  getFilters(): BaseFilter[] {
    return [...this.filters];
  }
}

class CustomFilter extends BaseFilter {
  constructor(
    name: string,
    private filterFn: (message: ParsedMessage) => ParsedMessage | null,
    enabled: boolean = true
  ) {
    super(name, enabled);
  }

  filter(message: ParsedMessage): ParsedMessage | null {
    if (!this.enabled) return message;
    return this.filterFn(message);
  }
}
