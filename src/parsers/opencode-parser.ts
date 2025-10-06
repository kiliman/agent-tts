import { BaseParser } from "./base-parser.js";
import { ParsedMessage } from "../types/config.js";
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
              
              // Get timestamp - use part time if available and non-zero, otherwise use message createdAt or file creation time
              const getTimestamp = () => {
                if (partMessage.time?.start && partMessage.time.start > 0) {
                  return new Date(partMessage.time.start);
                } else if (messageData.createdAt) {
                  // createdAt is in ISO format
                  return new Date(messageData.createdAt);
                } else if (filePath) {
                  // Use part file's creation time as last resort
                  try {
                    const stats = fs.statSync(filePath);
                    return new Date(stats.birthtime);
                  } catch (e) {
                    return new Date();
                  }
                } else {
                  return new Date();
                }
              };
              
              const timestamp = getTimestamp();
              
              // Process both assistant and user messages
              if (messageData.role === 'assistant') {
                messages.push({
                  role: "assistant",
                  content: partMessage.text,
                  timestamp: timestamp,
                  cwd: cwd
                });
                console.log(`[OpenCodeParser] Processing assistant message with cwd: ${cwd}, timestamp: ${timestamp.toISOString()}`);
              } else if (messageData.role === 'user') {
                messages.push({
                  role: "user",
                  content: partMessage.text,
                  timestamp: timestamp,
                  cwd: cwd
                });
                console.log(`[OpenCodeParser] Processing user message with cwd: ${cwd}, timestamp: ${timestamp.toISOString()}`);
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
