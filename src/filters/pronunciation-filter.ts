import { BaseFilter } from "./base-filter.js";
import { ParsedMessage } from "../types/config.js";

export class PronunciationFilter extends BaseFilter {
  private replacements: Map<string, string>;

  // Special characters that don't use word boundaries
  private static readonly SPECIAL_CHARACTERS = [
    "~",
    "→",
    "@",
    "#",
    "$",
    "%",
    "^",
    "&",
    "*",
    "`",
    "\\",
  ];

  // Default replacements for common technical terms
  private static readonly DEFAULT_REPLACEMENTS = new Map([
    ["git", "ghit"],
    ["github", "ghit hub"],
    ["gif", "jiff"],
    ["npm", "N P M"],
    ["api", "A P I"],
    ["url", "U R L"],
    ["sql", "sequel"],
    ["sqlite", "sequel light"],
    ["json", "jay son"],
    ["xml", "X M L"],
    ["html", "H T M L"],
    ["css", "C S S"],
    ["\\.js", "dot J S"],
    ["\\.ts", "dot T S"],
    ["ui", "you eye"],
    ["ux", "you ex"],
    ["cli", "C L I"],
    ["gui", "gooey"],
    ["ide", "I D E"],
    ["os", "O S"],
    ["io", "I O"],
    ["tts", "tee-tee-ess"],
    ["async", "a sync"],
    ["sync", "sink"],
    ["regex", "regh ex"],
    ["enum", "e num"],
    ["oauth", "oh auth"],
    ["uuid", "U U I D"],
    ["guid", "goo id"],
    ["rest", "REST"],
    ["graphql", "graph Q L"],
    ["yaml", "yam-ul"],
    ["dll", "D L L"],
    ["exe", "E X E"],
    ["pdf", "P D F"],
    ["png", "P N G"],
    ["jpg", "jay peg"],
    ["jpeg", "jay peg"],
    ["svg", "S V G"],
    ["mp3", "M P 3"],
    ["mp4", "M P 4"],
    ["~", "tilde"],
    ["`", "backtick"],
    ["\\", "backslash"],
    ["@", "at"],
    ["#", "hash"],
    ["$", "dollar"],
    ["%", "percent"],
    ["^", "caret"],
    ["&", "and"],
    ["*", "asterisk"],
    ["vite", "veet"],
    ["→", "to"],
  ]);

  constructor(customReplacements?: Record<string, string>) {
    super("pronunciation", true);

    // Start with default replacements
    this.replacements = new Map(PronunciationFilter.DEFAULT_REPLACEMENTS);

    // Add/override with custom replacements if provided
    if (customReplacements) {
      for (const [key, value] of Object.entries(customReplacements)) {
        this.replacements.set(key.toLowerCase(), value);
      }
    }
  }

  filter(message: ParsedMessage): ParsedMessage | null {
    if (!this.enabled) return message;

    let content = message.content;

    // Handle version numbers and dotted numbers (e.g., "0.1.0" -> "0 dot 1 dot 0")
    // Matches numbers separated by dots (e.g., 1.2.3, 0.1.0, 192.168.1.1)
    content = content.replace(/\b(\d+)\.(\d+(?:\.\d+)*)\b/g, (match) => {
      return match.split(".").join(" dot ");
    });

    for (const [original, replacement] of this.replacements) {
      // Escape special regex characters in the original string
      const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // Check if this is a special character that shouldn't use word boundaries
      if (PronunciationFilter.SPECIAL_CHARACTERS.includes(original)) {
        // Replace all occurrences (standalone or in context)
        const specialRegex = new RegExp(escaped, "g");
        content = content.replace(specialRegex, ` ${replacement} `);
      } else {
        // Use word boundaries for regular words
        const regex = new RegExp(`\\b${escaped}\\b`, "gi");
        content = content.replace(regex, ` ${replacement} `);
      }
    }

    // Add space between camelCase words (e.g., "myVariable" -> "my Variable")
    content = content.replace(/([a-z])([A-Z])/g, "$1 $2");

    // Removed the automatic spelling out of all uppercase words
    // Now only specific acronyms in the replacements map will be spelled out

    return {
      ...message,
      content,
    };
  }

  addReplacement(original: string, replacement: string): void {
    this.replacements.set(original.toLowerCase(), replacement);
  }

  removeReplacement(original: string): void {
    this.replacements.delete(original.toLowerCase());
  }
}
