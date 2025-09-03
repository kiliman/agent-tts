import { BaseParser } from "./base-parser";
import { ParsedMessage } from "../types/config";
import * as fs from "fs";
import * as path from "path";

export class OpenCodeParser extends BaseParser {
  parse(content: string, filePath?: string): ParsedMessage[] {
    const messages: ParsedMessage[] = [];

    try {
      const partMessage = JSON.parse(content);

      // Only process text messages
      if (partMessage.type === "text" && partMessage.text) {
        // Extract session ID and message ID from the part message
        const sessionId = partMessage.sessionID;
        const messageId = partMessage.messageID;
        
        if (sessionId && messageId) {
          // Construct path to the message file (new structure)
          const messagePath = path.join(
            process.env.HOME || '',
            '.local/share/opencode/storage/message',
            sessionId,
            `${messageId}.json`
          );
          
          try {
            // Check if the message file exists and read it
            if (fs.existsSync(messagePath)) {
              const messageContent = fs.readFileSync(messagePath, 'utf-8');
              const messageData = JSON.parse(messageContent);
              
              // Extract cwd from the message file
              const cwd = messageData.path?.cwd;
              
              // Only process assistant messages
              if (messageData.role === 'assistant') {
                messages.push({
                  role: "assistant",
                  content: partMessage.text,
                  timestamp: partMessage.time?.start ? new Date(partMessage.time.start) : new Date(),
                  cwd: cwd
                });
                console.log(`[OpenCodeParser] Processing assistant message with cwd: ${cwd}`);
              } else {
                console.log(`[OpenCodeParser] Skipping ${messageData.role} message`);
              }
            } else {
              console.log(`[OpenCodeParser] Message file not found: ${messagePath}`);
            }
          } catch (error) {
            console.log(`[OpenCodeParser] Error reading message file: ${error}`);
          }
        } else {
          console.log(`[OpenCodeParser] Missing sessionID or messageID in part message`);
        }
      }
    } catch (error) {
      // Skip invalid JSON lines
      console.log(`[OpenCodeParser] Skipping invalid JSON message: ${error}`);
    }

    return messages;
  }
}
