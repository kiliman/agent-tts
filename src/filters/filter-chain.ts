import { ParsedMessage, FilterConfig } from "../types/config";
import { BaseFilter } from "./base-filter";
import { PronunciationFilter } from "./pronunciation-filter";
import { LengthFilter } from "./length-filter";
import { RoleFilter } from "./role-filter";

export class FilterChain {
  private filters: BaseFilter[] = [];

  constructor(filterConfigs: FilterConfig[] = []) {
    this.initializeFilters(filterConfigs);
  }

  private initializeFilters(filterConfigs: FilterConfig[]): void {
    for (const config of filterConfigs) {
      if (config.filter) {
        const customFilter = new CustomFilter(
          config.name,
          config.filter,
          config.enabled ?? true
        );
        this.filters.push(customFilter);
      } else {
        const builtInFilter = this.createBuiltInFilter(
          config.name,
          config.enabled ?? true
        );
        if (builtInFilter) {
          this.filters.push(builtInFilter);
        }
      }
    }

    if (this.filters.length === 0) {
      this.filters.push(new RoleFilter(["assistant"]));
      this.filters.push(new PronunciationFilter());
    }
  }

  private createBuiltInFilter(
    name: string,
    enabled: boolean
  ): BaseFilter | null {
    switch (name) {
      case "pronunciation":
        const pronunciationFilter = new PronunciationFilter();
        pronunciationFilter.setEnabled(enabled);
        return pronunciationFilter;

      case "length":
        const lengthFilter = new LengthFilter();
        lengthFilter.setEnabled(enabled);
        return lengthFilter;

      case "role":
        const roleFilter = new RoleFilter();
        roleFilter.setEnabled(enabled);
        return roleFilter;

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
