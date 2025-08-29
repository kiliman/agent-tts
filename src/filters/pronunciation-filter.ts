import { BaseFilter } from "./base-filter";
import { ParsedMessage } from "../types/config";

export class PronunciationFilter extends BaseFilter {
  private replacements: Map<string, string> = new Map([
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
    ["ui", "U I"],
    ["ux", "U X"],
    ["cli", "C L I"],
    ["gui", "gooey"],
    ["ide", "I D E"],
    ["os", "O S"],
    ["io", "I O"],
    ["tts", "T T S"],
    ["async", "a sync"],
    ["sync", "sink"],
    ["regex", "reg ex"],
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
    ["/", "slash"],
    ["\\", "backslash"],
    ["@", "at"],
    ["#", "hash"],
    ["$", "dollar"],
    ["%", "percent"],
    ["^", "caret"],
    ["&", "and"],
    ["*", "asterisk"],
  ]);

  constructor() {
    super("pronunciation", true);
  }

  filter(message: ParsedMessage): ParsedMessage | null {
    if (!this.enabled) return message;

    let content = message.content;

    for (const [original, replacement] of this.replacements) {
      // Escape special regex characters in the original string
      const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, "gi");
      content = content.replace(regex, replacement);
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
