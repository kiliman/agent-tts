import { BaseParser } from "./base-parser";
import { ParsedMessage } from "../types/config";

export class OpenCodeParser extends BaseParser {
  parse(content: string): ParsedMessage[] {
    const messages: ParsedMessage[] = [];

    try {
      const message = JSON.parse(content);

      // Only process text messages
      if (message.type === "text" && message.text) {
        messages.push({
          role: "assistant",
          content: this.cleanContent(message.text),
          timestamp: message.time?.start ? new Date(message.time.start) : new Date(),
        });
      }
    } catch (error) {
      // Skip invalid JSON lines
      console.log(`[OpenCodeParser] Skipping invalid JSON message: ${error}`);
    }

    return messages;
  }
}
